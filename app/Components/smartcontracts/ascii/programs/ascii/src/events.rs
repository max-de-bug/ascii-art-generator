#[event]
pub struct MintEvent {
    pub minter: Pubkey,
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub timestamp: i64,
}

/// Event emitted when buyback occurs
#[event]
pub struct BuybackEvent {
    pub amount_sol: u64,
    pub token_amount: u64,
    pub timestamp: i64,
}