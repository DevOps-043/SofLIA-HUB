// electron/weather-tool.ts

/**
 * Herramienta de integración meteorológica nativa usando wttr.in.
 * Provee información climática y pronósticos de manera estructurada.
 */

/**
 * Consulta el clima actual y el pronóstico de los próximos días para una ubicación.
 * 
 * @param location Ciudad o ubicación a consultar (ej. "Madrid, Spain" o "Buenos Aires")
 * @returns Un string formateado en español con los datos meteorológicos listos para el LLM/WhatsApp
 */
export async function getWeather(location: string): Promise<string> {
  try {
    // Usar la API fetch global nativa de Node.js (cero dependencias).
    // Añadimos lang=es para intentar obtener las descripciones del clima en español.
    const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1&lang=es`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SofLIA-Hub-Weather-Tool/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`El servicio respondió con status: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Validar que la respuesta contenga los datos esperados
    if (!data || !data.current_condition || data.current_condition.length === 0) {
      return `No se encontraron datos meteorológicos para la ubicación "${location}".`;
    }

    // Extraer condiciones actuales
    const current = data.current_condition[0];
    const tempC = current.temp_C;
    const feelsLikeC = current.FeelsLikeC;
    
    // wttr.in en formato j1 con lang=es devuelve "lang_es", si no, hacemos fallback a "weatherDesc"
    const weatherDesc = current.lang_es?.[0]?.value || current.weatherDesc?.[0]?.value || 'Desconocido';
    const humidity = current.humidity;
    const windKmph = current.windspeedKmph;

    // Construir la respuesta estructurada
    let report = `🌤️ Clima actual en ${location}:\n`;
    report += `- Condición: ${weatherDesc}\n`;
    report += `- Temperatura: ${tempC}°C (Sensación térmica: ${feelsLikeC}°C)\n`;
    report += `- Humedad: ${humidity}%\n`;
    report += `- Viento: ${windKmph} km/h\n\n`;

    // Extraer pronóstico para los próximos días si está disponible
    if (data.weather && Array.isArray(data.weather)) {
      report += `📅 Pronóstico para los próximos días:\n`;
      
      // data.weather[0] suele ser el día actual, así que tomamos los índices 1 y 2 (próximos 2 días)
      const forecastDays = data.weather.slice(1, 3);
      
      if (forecastDays.length > 0) {
        for (const day of forecastDays) {
          const date = day.date;
          const maxTemp = day.maxtempC;
          const minTemp = day.mintempC;
          
          // Buscar una descripción general para el día tomando un punto intermedio (mediodía)
          let dayDesc = 'Desconocido';
          if (day.hourly && Array.isArray(day.hourly) && day.hourly.length > 0) {
            // El array hourly suele tener elementos cada 3 horas, el elemento del medio es aprox mediodía
            const midDay = day.hourly[Math.floor(day.hourly.length / 2)];
            dayDesc = midDay.lang_es?.[0]?.value || midDay.weatherDesc?.[0]?.value || 'Desconocido';
          }
          
          report += `- ${date}: Máx ${maxTemp}°C / Mín ${minTemp}°C, ${dayDesc}\n`;
        }
      } else {
        report += `- Pronóstico no disponible para los próximos días.\n`;
      }
    }

    return report.trim();

  } catch (error: any) {
    console.error('[WeatherTool] Error al obtener el clima:', error.message || error);
    // Retornar un fallback claro para el LLM y el usuario en caso de falla
    return `⚠️ No se pudo obtener el clima para "${location}". El servicio meteorológico podría estar temporalmente inaccesible. (Error: ${error.message || 'Desconocido'})`;
  }
}
