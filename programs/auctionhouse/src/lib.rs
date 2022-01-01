use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;

declare_id!("6tEWNsQDT8KZ2EDZRBa4CHRTxPESk6tvSJEwiddwSxkh");

#[program]
pub mod auctionhouse {
    use super::*;
    pub fn create_auction(ctx: Context<CreateAuction>, title: String, description: String, floor: i64, increment: i64) -> ProgramResult {
        let auction: &mut Account<Auction> = &mut ctx.accounts.auction;
        let owner: &Signer = &ctx.accounts.owner;
        let clock: Clock = Clock::get().unwrap();

        if title.chars().count() > 50 {
            return Err(ErrorCode::TitleOverflow.into())
        }
        if description.chars().count() > 280 {
            return Err(ErrorCode::DescriptionOverflow.into())
        }

        auction.owner = *owner.key;
        auction.start_time = clock.unix_timestamp;
        auction.cancelled = false;

        auction.title = title;
        auction.description = description;

        auction.bid_floor = floor;
        auction.min_bid_increment = increment;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateAuction<'info> {
    #[account(init, payer = owner, space = Auction::LEN)]
    pub auction: Account<'info, Auction>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[account]
pub struct Auction {
    pub owner: Pubkey,
    pub start_time: i64,
    pub cancelled: bool,

    pub title: String,
    pub description: String,

    // TODO add highest binding bid to only pay 2nd highest + min increment?
    // TODO keep track of all accounts and bids so people only increase their bid?
    pub max_bidder: Pubkey,
    pub max_bid: i64,
    pub bid_floor: i64,
    pub min_bid_increment: i64,
}

const DISCRIMINATOR_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
const I64_LENGTH: usize = 8;
const BOOL_LENGTH: usize = 1;
const STRING_LENGTH_PREFIX: usize = 4;
const MAX_TITLE_LENGTH: usize = 50 * 4;
const MAX_DESCRIPTION_LENGTH: usize = 280 * 4;

impl Auction {
    const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH // owner
        + I64_LENGTH // start time
        + BOOL_LENGTH // cancelled
        + STRING_LENGTH_PREFIX + MAX_TITLE_LENGTH // topic
        + STRING_LENGTH_PREFIX + MAX_DESCRIPTION_LENGTH // content
        + PUBLIC_KEY_LENGTH // max bidder
        + I64_LENGTH // max bid
        + I64_LENGTH // bid floor
        + I64_LENGTH; // min bid increment
}

#[error]
pub enum ErrorCode {
    #[msg("Title must be less than 50 characters.")]
    TitleOverflow,
    #[msg("Description must be less than 280 characters.")]
    DescriptionOverflow,
}
