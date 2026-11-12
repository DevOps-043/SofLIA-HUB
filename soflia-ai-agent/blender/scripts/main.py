"""Entrada actual: reconstrucción estructural sin animaciones ni optimización."""
from rebuild_base import main
import logging
import sys

if __name__ == '__main__':
    try:
        main()
    except Exception:
        logging.exception('Falló la reconstrucción estructural de SofLIA')
        sys.exit(1)
