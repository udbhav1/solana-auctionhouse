use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction::transfer;

declare_id!("6tEWNsQDT8KZ2EDZRBa4CHRTxPESk6tvSJEwiddwSxkh");

#[program]
pub mod auctionhouse {
    use super::*;
    pub fn create_auction(ctx: Context<CreateAuction>, title: String, floor: u64, increment: u64, bidder_cap: u64) -> ProgramResult {
        let auction: &mut Account<Auction> = &mut ctx.accounts.auction;
        let owner: &Signer = &ctx.accounts.owner;
        let clock: Clock = Clock::get().unwrap();

        if title.chars().count() > 50 {
            return Err(AuctionError::TitleOverflow.into())
        }

        auction.owner = *owner.key;
        auction.start_time = clock.unix_timestamp as u64;
        auction.cancelled = false;

        auction.title = title;

        auction.bidder_cap = bidder_cap;
        auction.highest_bid = 0;
        auction.bid_floor = floor;
        auction.min_bid_increment = increment;

        Ok(())
    }

    pub fn make_bid(ctx: Context<MakeBid>, amount: u64) -> ProgramResult {
        let auction: &mut Account<Auction> = &mut ctx.accounts.auction;
        let bidder: &Signer = &ctx.accounts.bidder;
        let system_program = &ctx.accounts.system_program;

        let index = auction.bidders.iter().position(|&x| x == *bidder.key);

        // new amount plus already bid amount
        let mut total_bid = amount;
        let mut new_bidder = false;

        if let None = index {
            if auction.bidders.len() >= (auction.bidder_cap as usize) {
                return Err(AuctionError::BidderCapReached.into())
            } else {
                new_bidder = true;
            }
        } else {
            total_bid += auction.bids[index.unwrap()];
        }

        if total_bid < auction.bid_floor {
            return Err(AuctionError::UnderBidFloor.into())
        }
        if total_bid < auction.highest_bid + auction.min_bid_increment {
            return Err(AuctionError::InsufficientBid.into())
        }

        if new_bidder {
            auction.bidders.push(*bidder.key);
            auction.bids.push(total_bid);
        } else {
            auction.bids[index.unwrap()] = total_bid;
        }

        auction.highest_bidder = *bidder.key;
        auction.highest_bid = total_bid;

        invoke(
            &transfer(bidder.key, &auction.key(), amount),
            &[
                bidder.clone().to_account_info(),
                auction.clone().to_account_info(),
                system_program.clone().to_account_info()
            ]
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(title: String, floor: u64, increment: u64, bidder_cap: u64)]
pub struct CreateAuction<'info> {
    #[account(init, payer = owner, space = Auction::LEN +
        VECTOR_LENGTH_PREFIX + (bidder_cap as usize)*PUBLIC_KEY_LENGTH +
        VECTOR_LENGTH_PREFIX + (bidder_cap as usize)*U64_LENGTH)]
    pub auction: Account<'info, Auction>,
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct MakeBid<'info> {
    #[account(mut)]
    pub auction: Account<'info, Auction>,
    #[account(mut)]
    pub bidder: Signer<'info>,
    #[account(address = system_program::ID)]
    pub system_program: AccountInfo<'info>,
}

#[account]
pub struct Auction {
    pub owner: Pubkey,
    pub start_time: u64,
    pub cancelled: bool,

    pub title: String,

    pub bidder_cap: u64,
    pub bidders: Vec<Pubkey>,
    pub bids: Vec<u64>,

    pub highest_bidder: Pubkey,
    pub highest_bid: u64,

    pub bid_floor: u64,
    pub min_bid_increment: u64,
}

const DISCRIMINATOR_LENGTH: usize = 8;
const PUBLIC_KEY_LENGTH: usize = 32;
const U64_LENGTH: usize = 8;
const BOOL_LENGTH: usize = 1;
const STRING_LENGTH_PREFIX: usize = 4;
const MAX_TITLE_LENGTH: usize = 50 * 4;

const VECTOR_LENGTH_PREFIX: usize = 4;

impl Auction {
    const LEN: usize = DISCRIMINATOR_LENGTH
        + PUBLIC_KEY_LENGTH // owner
        + U64_LENGTH // start time
        + BOOL_LENGTH // cancelled
        + STRING_LENGTH_PREFIX + MAX_TITLE_LENGTH // title
        + U64_LENGTH // bidder cap
        + PUBLIC_KEY_LENGTH // highest bidder
        + U64_LENGTH // highest bid
        + U64_LENGTH // bid floor
        + U64_LENGTH; // min bid increment
}

#[error]
pub enum AuctionError {
    #[msg("Title must be less than 50 characters.")]
    TitleOverflow,
    #[msg("Must bid higher than the floor.")]
    UnderBidFloor,
    #[msg("Must bid at least min_bid_increment higher than max_bid.")]
    InsufficientBid,
    #[msg("Auction is cancelled and not accepting bids.")]
    BidAfterCancelled,
    #[msg("Auction period has elapsed")]
    BidAfterClose,
    #[msg("Maximum number of unique bidders has been reached.")]
    BidderCapReached,
}