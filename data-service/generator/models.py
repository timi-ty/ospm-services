from dataclasses import dataclass
from datetime import datetime


@dataclass
class MarketProposal:
    question: str
    description: str
    source_url: str
    category: str
    betting_closes_at: str  # ISO timestamp
    resolves_at: str        # ISO timestamp
    resolution_context: str

    def is_valid(self) -> bool:
        """Validate the proposal."""
        if not self.question or not self.question.endswith('?'):
            return False
        
        try:
            closes = datetime.fromisoformat(self.betting_closes_at.replace('Z', '+00:00'))
            resolves = datetime.fromisoformat(self.resolves_at.replace('Z', '+00:00'))
            
            # betting_closes_at must be in the future
            if closes <= datetime.now(closes.tzinfo):
                return False
            
            # resolves_at must be after betting_closes_at
            if resolves <= closes:
                return False
                
        except (ValueError, TypeError):
            return False
        
        return True
