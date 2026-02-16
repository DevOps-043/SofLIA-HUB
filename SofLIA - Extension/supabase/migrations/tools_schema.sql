-- ==========================================
-- SOFLIA Tool Library - Database Schema
-- ==========================================
-- Migration: tools_schema.sql
-- Created: 2026-02-09
-- Description: Creates tables for public and private tool libraries

-- ==========================================
-- TIPOS ENUMERADOS
-- ==========================================

-- Categorías predefinidas para herramientas
CREATE TYPE tool_category AS ENUM (
    'desarrollo',
    'marketing', 
    'educacion',
    'productividad',
    'creatividad',
    'analisis'
);

-- Estado de aprobación para herramientas públicas
CREATE TYPE tool_status AS ENUM (
    'pending',    -- Pendiente de revisión por admin
    'approved',   -- Aprobada y visible públicamente
    'rejected'    -- Rechazada por admin
);

-- ==========================================
-- HERRAMIENTAS PÚBLICAS (con moderación)
-- ==========================================
CREATE TABLE public.tools (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Autor (quien propuso la herramienta)
    author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Metadatos básicos
    name text NOT NULL,
    description text NOT NULL,
    icon text DEFAULT '🔧',
    category tool_category NOT NULL,
    
    -- El prompt que se inyectará al modelo de IA
    system_prompt text NOT NULL,
    
    -- Prompts de inicio sugeridos (array de strings)
    starter_prompts jsonb DEFAULT '[]',
    
    -- Workflow de moderación
    status tool_status DEFAULT 'pending',
    reviewed_by uuid REFERENCES auth.users(id),
    reviewed_at timestamptz,
    rejection_reason text,
    
    -- Estadísticas de uso
    usage_count integer DEFAULT 0,
    is_featured boolean DEFAULT false,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Comentarios descriptivos
COMMENT ON TABLE public.tools IS 'Catálogo público de herramientas (prompts) disponibles para todos los usuarios';
COMMENT ON COLUMN public.tools.status IS 'Estado de moderación: pending, approved, rejected';
COMMENT ON COLUMN public.tools.system_prompt IS 'Instrucciones del sistema que se inyectan al modelo de IA';

-- ==========================================
-- HERRAMIENTAS PRIVADAS DEL USUARIO
-- ==========================================
CREATE TABLE public.user_tools (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Metadatos
    name text NOT NULL,
    description text,
    icon text DEFAULT '⚙️',
    category tool_category,
    
    -- El prompt de la herramienta
    system_prompt text NOT NULL,
    
    -- Prompts de inicio opcionales
    starter_prompts jsonb DEFAULT '[]',
    
    -- Preferencias del usuario
    is_favorite boolean DEFAULT false,
    usage_count integer DEFAULT 0,
    
    -- Timestamps
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.user_tools IS 'Biblioteca privada de herramientas personalizadas por usuario';

-- RLS para herramientas privadas
ALTER TABLE public.user_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus propias herramientas"
ON public.user_tools FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propias herramientas"
ON public.user_tools FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propias herramientas"
ON public.user_tools FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propias herramientas"
ON public.user_tools FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================
-- FAVORITOS DE HERRAMIENTAS PÚBLICAS
-- ==========================================
CREATE TABLE public.user_favorite_tools (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tool_id uuid REFERENCES public.tools(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, tool_id)
);

COMMENT ON TABLE public.user_favorite_tools IS 'Relación de herramientas públicas marcadas como favoritas por usuarios';

ALTER TABLE public.user_favorite_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver sus favoritos"
ON public.user_favorite_tools FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden añadir favoritos"
ON public.user_favorite_tools FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus favoritos"
ON public.user_favorite_tools FOR DELETE
USING (auth.uid() = user_id);

-- ==========================================
-- ÍNDICES PARA RENDIMIENTO
-- ==========================================
CREATE INDEX idx_tools_category ON public.tools(category);
CREATE INDEX idx_tools_status ON public.tools(status);
CREATE INDEX idx_tools_featured ON public.tools(is_featured) WHERE is_featured = true;
CREATE INDEX idx_tools_author ON public.tools(author_id);
CREATE INDEX idx_user_tools_user_id ON public.user_tools(user_id);
CREATE INDEX idx_user_tools_favorite ON public.user_tools(is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_user_favorite_tools_user ON public.user_favorite_tools(user_id);
CREATE INDEX idx_user_favorite_tools_tool ON public.user_favorite_tools(tool_id);

-- ==========================================
-- FUNCIÓN PARA ACTUALIZAR updated_at
-- ==========================================
CREATE OR REPLACE FUNCTION update_tools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_tools_updated_at
    BEFORE UPDATE ON public.tools
    FOR EACH ROW
    EXECUTE FUNCTION update_tools_updated_at();

CREATE TRIGGER trigger_user_tools_updated_at
    BEFORE UPDATE ON public.user_tools
    FOR EACH ROW
    EXECUTE FUNCTION update_tools_updated_at();

-- ==========================================
-- DATOS INICIALES DE EJEMPLO
-- ==========================================
-- Insertar algunas herramientas públicas de ejemplo (ya aprobadas)
INSERT INTO public.tools (name, description, icon, category, system_prompt, status, is_featured, starter_prompts) VALUES
(
    'Experto en Código',
    'Un asistente especializado en desarrollo de software y debugging.',
    '💻',
    'desarrollo',
    'Eres un experto programador senior con 20 años de experiencia. Ayudas a resolver problemas de código, sugieres mejores prácticas y explicas conceptos técnicos de forma clara. Siempre proporcionas ejemplos de código cuando es relevante.',
    'approved',
    true,
    '["¿Cómo puedo optimizar este código?", "Explícame el patrón de diseño Observer", "¿Cuál es la diferencia entre REST y GraphQL?"]'
),
(
    'Redactor de Marketing',
    'Genera copy persuasivo para campañas de marketing digital.',
    '📝',
    'marketing',
    'Eres un copywriter experto en marketing digital. Creas textos persuasivos, headlines atractivos y CTAs efectivos. Conoces técnicas como AIDA, PAS y más. Adaptas el tono según la marca y audiencia objetivo.',
    'approved',
    true,
    '["Escribe un headline para mi producto", "Crea una descripción para redes sociales", "Mejora este texto de venta"]'
),
(
    'Tutor Educativo',
    'Explica temas complejos de forma simple y pedagógica.',
    '🎓',
    'educacion',
    'Eres un tutor paciente y experto en pedagogía. Explicas conceptos complejos usando analogías simples, ejemplos cotidianos y pasos progresivos. Te aseguras de que el estudiante entienda antes de avanzar.',
    'approved',
    false,
    '["Explícame la relatividad como si tuviera 10 años", "¿Cómo funciona la fotosíntesis?", "Enséñame sobre la revolución industrial"]'
),
(
    'Planificador de Productividad',
    'Ayuda a organizar tareas, establecer prioridades y gestionar el tiempo.',
    '📋',
    'productividad',
    'Eres un experto en productividad y gestión del tiempo. Conoces metodologías como GTD, Pomodoro, Eisenhower Matrix y más. Ayudas a priorizar tareas, establecer metas SMART y crear planes de acción claros.',
    'approved',
    false,
    '["Ayúdame a organizar mi semana", "¿Cómo puedo priorizar estas tareas?", "Crea un plan para mi proyecto"]'
),
(
    'Analista de Datos',
    'Interpreta datos, encuentra patrones y genera insights accionables.',
    '📊',
    'analisis',
    'Eres un analista de datos experto. Ayudas a interpretar datasets, encontrar correlaciones, identificar outliers y generar visualizaciones mentales. Explicas estadísticas de forma comprensible y sugieres acciones basadas en los datos.',
    'approved',
    false,
    '["¿Qué me dicen estos números de ventas?", "Analiza esta encuesta de satisfacción", "¿Qué métricas debo trackear?"]'
);
