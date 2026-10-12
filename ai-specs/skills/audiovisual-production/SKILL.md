---
name: audiovisual-production
description: Implementa o revisa la skill runtime audiovisual del Hub, su manifiesto film.json, render MP4, cancelación y QA técnico.
---

# Producción audiovisual del Hub

Lee [el contrato y operación](../../../docs/architecture/presentation-audiovisual-production.md) antes de cambiar el render. Esta es una skill de desarrollo: no se empaqueta como herramienta runtime.

La composición React compartida debe producir el mismo frame para el mismo manifiesto y número de fotograma. El bundle es código propio compilado; el modelo sólo aporta datos estrictos de film.json. No ejecutar código generado por el modelo. Las rutas de ejecutables pertenecen a main y la configuración del equipo; nunca al manifiesto.

Inspecciona el inicio, desarrollo, acciones, transferencias y último frame de cada escena. Chromium debe confirmar la firma del fotograma antes de capturarlo; la firma queda fuera del video y se recorta. No confiar en capturas ocultas que puedan devolver la pintura anterior. Proyecta máscaras y aros con el mismo origen de cámara y captura los puntos intermedios de transiciones. Comprueba también separación temporal de titulares, destacados literales y contraste de acentos. En música preserva una pausa antes de la resolución y no confundas volumen con calidad. El acompañamiento actual usa piano sintético amortiguado y armonías cálidas; no lo presentes como grabación acústica ni permitas pitidos que dominen la mezcla. Mantén fuentes locales licenciadas, regiones seguras y continuidad de objetos. La inspección devuelve imágenes al agente y vincula la geometría al hash del bundle y manifiesto; no reemplaza la revisión visual.

La partitura deriva del mismo reloj de escenas y acciones. Usa Web Audio offline para síntesis PCM estéreo de 24 bits y FFmpeg para masterizar y medir el AAC antes de renderizar imágenes. Conserva esa pista al muxear y mide otra vez el MP4 final. No prometas igualdad binaria entre motores DSP nativos ni calidad perceptiva sin escucha.

Comprueba frames, timestamps, formato, duración y audio en el archivo final. No confundir un manifiesto válido o un proceso terminado con un MP4 verificado. Vincula el QA a hashes del manifiesto y video. La inspección técnica no demuestra calidad cinematográfica ni legitimidad de la marca.

Prueba cancelación, edición durante render, entrada malformada, contextos ajenos, falta de binarios y cuotas. Los cambios IPC conservan las cuatro capas y requieren pruebas de contrato. Renderiza un ejemplo real y revisa fotogramas antes de declarar mejoras visuales.

Para comparar capacidades, separa un fixture dirigido de una generación autónoma. Ejecuta el evaluador real del producto, conserva también fallos y versiones por hash, y no conviertas un perfil técnico equivalente en superioridad estética. Los evaluadores no deben guardar bundles con credenciales ni utilizar el perfil de la sesión abierta. El informe distingue calidad técnica, repertorio visual y revisión perceptiva pendiente.
