pub mod account;
pub mod context;
pub mod error;
pub mod utils;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{program::invoke, system_instruction::transfer};
use account::*;
use context::*;
use error::*;
use utils::*;

declare_id!("6tEWNsQDT8KZ2EDZRBa4CHRTxPESk6tvSJEwiddwSxkh");

#[program]
pub mod auctionhouse {
    use super::*;
    pub fn create_auction(ctx: Context<CreateAuction>, bump: u8, title: String, floor: u64, increment: u64, start_time: u64, end_time: u64, bidder_cap: u64) -> ProgramResult {
        let auction = &mut ctx.accounts.auction;
        let owner: &Signer = &ctx.accounts.owner;
        let clock: Clock = Clock::get().unwrap();
        let cur_time: u64 = clock.unix_timestamp as u64;

        require!(title.chars().count() <= 50, Err(AuctionError::TitleOverflow.into()));
        require!(increment != 0, Err(AuctionError::InvalidIncrement.into()));
        require!(start_time < end_time, Err(AuctionError::InvalidStartTime.into()));
        require!(cur_time > start_time || start_time == 0, Err(AuctionError::InvalidStartTime.into()));
        require!(cur_time < end_time, Err(AuctionError::InvalidEndTime.into()));

        auction.owner = *owner.key;
        auction.start_time = if start_time == 0 { cur_time } else { start_time };
        auction.end_time = end_time;
        auction.cancelled = false;

        auction.title = title;

        auction.bidder_cap = bidder_cap;
        auction.highest_bid = 0;
        auction.bid_floor = floor;
        auction.min_bid_increment = increment;

        auction.bump = bump;

        Ok(())
    }

    pub fn cancel_auction(ctx: Context<CancelAuction>) -> ProgramResult {
        let auction: &mut Account<Auction> = &mut ctx.accounts.auction;

        auction.cancelled = true;

        Ok(())
    }

    pub fn make_bid(ctx: Context<MakeBid>, amount: u64) -> ProgramResult {
        let auction = &mut ctx.accounts.auction;
        let bidder: &Signer = &ctx.accounts.bidder;
        let system_program = &ctx.accounts.system_program;
        let clock: Clock = Clock::get().unwrap();
        let cur_time: u64 = clock.unix_timestamp as u64;

        require!(!auction.cancelled, Err(AuctionError::BidAfterCancelled.into()));
        require!(cur_time > auction.start_time, Err(AuctionError::BidBeforeStart.into()));
        require!(cur_time < auction.end_time, Err(AuctionError::BidAfterClose.into()));
        require!(*bidder.key != auction.owner, Err(AuctionError::OwnerCannotBid.into()));

        let index = auction.bidders.iter().position(|&x| x == *bidder.key);

        // new amount plus already bid amount
        let mut total_bid = amount;
        let mut new_bidder = false;

        if let None = index {
            require!(auction.bidders.len() < (auction.bidder_cap as usize), Err(AuctionError::BidderCapReached.into()));
            new_bidder = true;
        } else {
            total_bid += auction.bids[index.unwrap()];
        }

        require!(total_bid > auction.bid_floor, Err(AuctionError::UnderBidFloor.into()));
        require!(total_bid > (auction.highest_bid + auction.min_bid_increment), Err(AuctionError::InsufficientBid.into()));

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

    pub fn reclaim_bid(ctx: Context<ReclaimBid>) -> ProgramResult {
        let auction = &mut ctx.accounts.auction;
        let bidder: &Signer = &ctx.accounts.bidder;
        let clock: Clock = Clock::get().unwrap();
        let cur_time: u64 = clock.unix_timestamp as u64;

        require!(auction.cancelled || cur_time > auction.end_time, Err(AuctionError::AuctionNotOver.into()));

        let index = auction.bidders.iter().position(|&x| x == *bidder.key);
        if let None = index {
            return Err(AuctionError::NotPreviousBidder.into())
        } else if *bidder.key == auction.highest_bidder && !auction.cancelled {
            return Err(AuctionError::WinnerCannotWithdrawBid.into())
        } else {
            let bid = auction.bids[index.unwrap()];

            let src = &mut auction.to_account_info();
            let dst = &mut bidder.to_account_info();

            transfer_from_owned_account(src, dst, bid)?;
        }

        Ok(())
    }

    pub fn withdraw_item(ctx: Context<WithdrawItem>) -> ProgramResult {
        Ok(())
    }

    pub fn withdraw_winning_bid(ctx: Context<WithdrawWinningBid>) -> ProgramResult {
        let auction = &mut ctx.accounts.auction;
        let owner: &Signer = &ctx.accounts.owner;
        let clock: Clock = Clock::get().unwrap();
        let cur_time: u64 = clock.unix_timestamp as u64;

        require!(auction.cancelled || cur_time > auction.end_time, Err(AuctionError::AuctionNotOver.into()));

        let index = auction.bidders.iter().position(|&x| x == auction.highest_bidder);
        if let None = index {
            return Err(AuctionError::NoBids.into())
        } else {
            let winning_bid = auction.bids[index.unwrap()];

            let src = &mut auction.to_account_info();
            let dst = &mut owner.to_account_info();

            transfer_from_owned_account(src, dst, winning_bid)?;
        }

        Ok(())
    }

    pub fn reclaim_item(ctx: Context<ReclaimItem>) -> ProgramResult {
        Ok(())
    }
}