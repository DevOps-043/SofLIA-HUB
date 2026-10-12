---
name: audiovisual-production
description: Implementa o revisa la skill runtime audiovisual del Hub, su manifiesto film.json, render MP4, cancelación y QA técnico.
---

# Producción audiovisual del Hub

Lee [el contrato y operación](../../../docs/architecture/presentation-audiovisual-production.md) antes de cambiar el render. Esta es una skill de desarrollo: no se empaqueta como herramienta runtime.

La función SVG compartida debe producir el mismo frame para el mismo manifiesto y número de fotograma. No ejecutar código generado por el modelo. Las rutas de ejecutables pertenecen a main y la configuración del equipo; nunca al manifiesto.

Comprueba frames, timestamps, formato, duración y audio en el archivo final. No confundir un manifiesto válido o un proceso terminado con un MP4 verificado. Vincula el QA a hashes del manifiesto y video. La inspección técnica no demuestra calidad cinematográfica ni legitimidad de la marca.

Prueba cancelación, edición durante render, entrada malformada, contextos ajenos, falta de binarios y cuotas. Los cambios IPC conservan las cuatro capas y requieren pruebas de contrato. Renderiza un ejemplo real y revisa fotogramas antes de declarar mejoras visuales.
