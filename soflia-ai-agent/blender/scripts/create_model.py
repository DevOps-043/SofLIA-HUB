"""Entrada de modelado: superficies específicas trazadas desde la referencia aprobada."""
from reconstructed_model import create_reference_model


def create_model(materials):
    return create_reference_model(materials)
