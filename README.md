# Solana Auctionhouse

Auction protocol for open ascending (English), sealed first-price, and sealed second-price (Vickrey) auctions

## Implementation Details

Both types of auctions have SPL tokens (e.g. an NFT) as the auction item and accept bids in SOL.

The maximum number of active bidders is capped by an argument provided on auction creation. This is because the Solana runtime needs to know how much space to allocate for the auction account.

The auction account is a PDA owned by the auctionhouse program to allow it to act as an escrow.

### Open Auction

add function names here?
- The seller creates an auction and escrows their SPL tokens
- Bidders make public bids and their SOL is escrowed in the auction PDA
- Bidders can reclaim their SOL at any time, unless they're the current highest bidder
- Bidding is cumulative, so a bidder with 70 SOL escrowed can send an additional 10.1 SOL to beat a bid of 80 SOL
- The seller can cancel the auction any time before it ends, allowing them to reclaim the SPL tokens and allowing every bidder to reclaim their bids
- When the auction ends, the winner can withdraw the SPL tokens and the seller can withdraw the winning bid.

### Sealed Auction

## Quickstart

Install [Anchor](https://github.com/project-serum/anchor) if necessary

```
$ git clone https://github.com/udbhav1/solana-auctionhouse && cd solana-auctionhouse
$ yarn
$ anchor test
```

The tests use a `delay()` function to wait for the auction period and reveal period to end. Depending on how fast your machine runs the test suite, you may need to modify the `auctionEndDelay` and `revealPeriodEndDelay` variables.

## Possible Improvements

- Allow unlimited bidders by having each bidder fund a PDA derived from their public key that contains metadata about their bid
- Allow the owner to close the auction PDA and reclaim its rent
- Add an "instant buy" price that immediately ends the auction when reached
- Allow bids in arbitrary SPL tokens
- Allow multiple mints for the auction item(s) so many different things can be auctioned together
