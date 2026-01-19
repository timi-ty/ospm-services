import logging

logger = logging.getLogger(__name__)


def chunk_corpus(corpus: str, max_chars: int) -> list[str]:
    """
    Split corpus into chunks that fit within token limits.
    Splits on page boundaries (--- PAGE: ... ---) to keep context intact.
    """
    if len(corpus) <= max_chars:
        return [corpus]

    chunks: list[str] = []
    # Split on page boundaries
    pages = corpus.split("\n\n--- PAGE:")

    current_chunk = ""
    for i, page in enumerate(pages):
        # Restore the page marker (except for first page which doesn't have it)
        page_with_marker = f"\n\n--- PAGE:{page}" if i > 0 else page

        # Check if adding this page would exceed limit
        if len(current_chunk) + len(page_with_marker) <= max_chars:
            current_chunk += page_with_marker
        else:
            # Save current chunk if not empty
            if current_chunk.strip():
                chunks.append(current_chunk)
            
            # Start new chunk with this page
            # If single page exceeds limit, truncate it
            if len(page_with_marker) > max_chars:
                logger.warning(f"Single page exceeds max_chars ({len(page_with_marker)} > {max_chars}), truncating")
                current_chunk = page_with_marker[:max_chars]
            else:
                current_chunk = page_with_marker

    # Don't forget the last chunk
    if current_chunk.strip():
        chunks.append(current_chunk)

    logger.info(f"Split corpus ({len(corpus)} chars) into {len(chunks)} chunks")
    return chunks
