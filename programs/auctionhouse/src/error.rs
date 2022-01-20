use anchor_lang::prelude::*;

#[error]
pub enum AuctionError {
    #[msg("Title must be less than 50 characters.")]
    TitleOverflow,
    #[msg("Minimum bid increment must be greater than 0.")]
    InvalidIncrement,
    #[msg("Start time must be in the future and before end time.")]
    InvalidStartTime,
    #[msg("End time must be after start time.")]
    InvalidEndTime,
    #[msg("Must bid higher than the floor.")]
    UnderBidFloor,
    #[msg("Must bid at least min_bid_increment higher than max_bid.")]
    InsufficientBid,
    #[msg("Auction is cancelled and only allows reclaiming past bids and the item.")]
    AuctionCancelled,
    #[msg("Auction period has not yet begun.")]
    BidBeforeStart,
    #[msg("Auction period has elapsed.")]
    BidAfterClose,
    #[msg("Maximum number of unique bidders has been reached.")]
    BidderCapReached,
    #[msg("Owner cannot bid on auction.")]
    OwnerCannotBid,
    #[msg("Auction is not over.")]
    AuctionNotOver,
    #[msg("No previous bid associated with this key.")]
    NotBidder,
    #[msg("Bid associated with this key has already been reclaimed.")]
    AlreadyReclaimedBid,
    #[msg("No winning bid to withdraw.")]
    NoWinningBid,
    #[msg("Auction winner cannot withdraw their bid.")]
    WinnerCannotWithdrawBid,
    #[msg("Winning bid has already been withdrawn.")]
    AlreadyWithdrewBid,
    #[msg("Each key can only have one active sealed bid per auction.")]
    DuplicateSealedBid,
}