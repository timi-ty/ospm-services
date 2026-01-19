from dataclasses import dataclass


@dataclass
class ModelConfig:
    name: str
    max_tokens: int          # Total context window
    max_output_tokens: int   # Reserved for response
    chars_per_token: float   # Approximation for chunking


MODELS: dict[str, ModelConfig] = {
    "gpt-4-turbo-preview": ModelConfig(
        name="gpt-4-turbo-preview",
        max_tokens=128000,
        max_output_tokens=4096,
        chars_per_token=4.0,
    ),
    "gpt-4o": ModelConfig(
        name="gpt-4o",
        max_tokens=128000,
        max_output_tokens=4096,
        chars_per_token=4.0,
    ),
    "gpt-4o-mini": ModelConfig(
        name="gpt-4o-mini",
        max_tokens=128000,
        max_output_tokens=4096,
        chars_per_token=4.0,
    ),
    "gpt-3.5-turbo": ModelConfig(
        name="gpt-3.5-turbo",
        max_tokens=16385,
        max_output_tokens=4096,
        chars_per_token=4.0,
    ),
}


def get_max_corpus_chars(model_name: str, prompt_chars: int) -> int:
    """Calculate max corpus size for a model, accounting for prompt overhead."""
    config = MODELS.get(model_name, MODELS["gpt-4-turbo-preview"])
    available_tokens = config.max_tokens - config.max_output_tokens
    available_chars = int(available_tokens * config.chars_per_token)
    return available_chars - prompt_chars - 1000  # Safety margin
