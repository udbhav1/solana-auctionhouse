import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Auctionhouse } from '../target/types/auctionhouse';
import * as assert from "assert";

function lamports(sol){
  return sol*anchor.web3.LAMPORTS_PER_SOL;
}

describe('auctionhouse', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  // @ts-ignore
  const program = anchor.workspace.Auctionhouse as Program<Auctionhouse>;

  it('can make auction', async () => {

    let title = "test title";
    let floor = 100;
    let increment = 10;
    let biddercap = 10;
    let endtime = Math.floor(Date.now() / 1000) + 600;

    const [auctionAddress, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("auction"), program.provider.wallet.publicKey.toBytes(), Buffer.from(title.slice(0, 32))],
      program.programId
    )

    await program.rpc.createAuction(new anchor.BN(bump),
                                    title,
                                    new anchor.BN(floor),
                                    new anchor.BN(increment),
                                    new anchor.BN(0),
                                    new anchor.BN(endtime),
                                    new anchor.BN(biddercap), {
        accounts: {
          auction: auctionAddress,
          owner: program.provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [],
    });

    const auctionAccount = await program.account.auction.fetch(auctionAddress);

  	assert.equal(auctionAccount.owner.toBase58(), program.provider.wallet.publicKey.toBase58());
    assert.ok(auctionAccount.startTime);
    assert.equal(auctionAccount.cancelled, false);
    assert.equal(auctionAccount.title, title);
    assert.equal(auctionAccount.bidFloor, floor);
    assert.equal(auctionAccount.minBidIncrement, increment);
    assert.equal(auctionAccount.bidderCap, biddercap);
  });

  it('new wallet can make auction', async () => {

    // create new wallet and airdrop 1 sol in lamports
    const newUser = anchor.web3.Keypair.generate();
    const signature = await program.provider.connection.requestAirdrop(newUser.publicKey, lamports(1));
    await program.provider.connection.confirmTransaction(signature);

    let title = "test title";
    let floor = 100;
    let increment = 10;
    let biddercap = 10;
    let endtime = Math.floor(Date.now() / 1000) + 600;

    const [auctionAddress, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("auction"), newUser.publicKey.toBytes(), Buffer.from(title.slice(0, 32))],
      program.programId
    )

    await program.rpc.createAuction(new anchor.BN(bump),
                                    title,
                                    new anchor.BN(floor),
                                    new anchor.BN(increment),
                                    new anchor.BN(0),
                                    new anchor.BN(endtime),
                                    new anchor.BN(biddercap), {
        accounts: {
          auction: auctionAddress,
          owner: newUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [newUser],
    });
    const auctionAccount = await program.account.auction.fetch(auctionAddress);

  	assert.equal(auctionAccount.owner.toBase58(), newUser.publicKey.toBase58());
    assert.ok(auctionAccount.startTime);
    assert.equal(auctionAccount.cancelled, false);
    assert.equal(auctionAccount.title, title);
    assert.equal(auctionAccount.bidFloor, floor);
    assert.equal(auctionAccount.minBidIncrement, increment);
    assert.equal(auctionAccount.bidderCap, biddercap);

  });

  it('title must be less than 50 characters', async () => {
    try {
        const auction = anchor.web3.Keypair.generate();
        let title = 'a'.repeat(51);
        let floor = lamports(0.1);
        let increment = lamports(0.05);
        let biddercap = 2;
        let endtime = Math.floor(Date.now() / 1000) + 600;

        const [auctionAddress, bump] = await anchor.web3.PublicKey.findProgramAddress(
          [Buffer.from("auction"), program.provider.wallet.publicKey.toBytes(), Buffer.from(title.slice(0, 32))],
          program.programId
        )
        await program.rpc.createAuction(new anchor.BN(bump), 
                                    title, 
                                    new anchor.BN(floor),
                                    new anchor.BN(increment),
                                    new anchor.BN(0),
                                    new anchor.BN(endtime),
                                    new anchor.BN(biddercap), {
            accounts: {
                auction: auctionAddress,
                owner: program.provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [],
        });
    } catch (error) {
        console.log(error);
        assert.equal(error.msg, 'Title must be less than 50 characters.');
        return;
    }

    assert.fail('The instruction should have failed with a 51-character title.');
  });

  it('can fetch all auctions', async () => {
    const auctionAccounts = await program.account.auction.all();
    assert.equal(auctionAccounts.length, 2);
  });

  it('owner can cancel auction', async () => {
    let title = "test cancel";
    let floor = lamports(0.1);
    let increment = lamports(0.05);
    let biddercap = 2;
    let endtime = Math.floor(Date.now() / 1000) + 600;

    const [auctionAddress, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("auction"), program.provider.wallet.publicKey.toBytes(), Buffer.from(title.slice(0, 32))],
      program.programId
    )

    await program.rpc.createAuction(new anchor.BN(bump),
                                    title,
                                    new anchor.BN(floor),
                                    new anchor.BN(increment),
                                    new anchor.BN(0),
                                    new anchor.BN(endtime),
                                    new anchor.BN(biddercap), {
        accounts: {
          auction: auctionAddress,
          owner: program.provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [],
    });

    await program.rpc.cancelAuction({
        accounts: {
          auction: auctionAddress,
          owner: program.provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
    });

    let auctionAccount = await program.account.auction.fetch(auctionAddress);
    assert.equal(auctionAccount.cancelled, true);

  });

  it('two users can bid and then withdraw funds', async () => {
    let title = "test bid and withdraw";
    let floor = lamports(0.1);
    let increment = lamports(0.05);
    let biddercap = 2;
    let endtime = Math.floor(Date.now() / 1000) + 600;

    let bid1 = lamports(0.5);
    let bid2 = lamports(0.6);
    let bid3 = lamports(0.2);

    let initialBalance1 = lamports(5);
    let initialBalance2 = lamports(5);
    let initialBalanceOwner = lamports(5);

    const auctioneer = anchor.web3.Keypair.generate();
    const ownerAirdrop = await program.provider.connection.requestAirdrop(auctioneer.publicKey, initialBalanceOwner);
    await program.provider.connection.confirmTransaction(ownerAirdrop);

    const [auctionAddress, bump] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("auction"), auctioneer.publicKey.toBytes(), Buffer.from(title.slice(0, 32))],
      program.programId
    )

    await program.rpc.createAuction(new anchor.BN(bump),
                                    title,
                                    new anchor.BN(floor),
                                    new anchor.BN(increment),
                                    new anchor.BN(0),
                                    new anchor.BN(endtime),
                                    new anchor.BN(biddercap), {
        accounts: {
          auction: auctionAddress,
          owner: auctioneer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [auctioneer],
    });

    const bidder1 = anchor.web3.Keypair.generate();
    const airdrop1 = await program.provider.connection.requestAirdrop(bidder1.publicKey, initialBalance1);
    await program.provider.connection.confirmTransaction(airdrop1);

    const bidder2 = anchor.web3.Keypair.generate();
    const airdrop2 = await program.provider.connection.requestAirdrop(bidder2.publicKey, initialBalance2);
    await program.provider.connection.confirmTransaction(airdrop2);

    let prebid1 = await program.provider.connection.getBalance(bidder1.publicKey);
    let prebid2 = await program.provider.connection.getBalance(bidder2.publicKey);
    let prebidauction = await program.provider.connection.getBalance(auctionAddress);
    let prebidowner = await program.provider.connection.getBalance(auctioneer.publicKey);

    await program.rpc.makeBid(new anchor.BN(bid1), {
        accounts: {
          auction: auctionAddress,
          bidder: bidder1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [bidder1],
    });

    let auctionAccount = await program.account.auction.fetch(auctionAddress);
    assert.equal(auctionAccount.highestBidder.toBase58(), bidder1.publicKey.toBase58());
    assert.equal(auctionAccount.highestBid, bid1);

    await program.rpc.makeBid(new anchor.BN(bid2), {
        accounts: {
          auction: auctionAddress,
          bidder: bidder2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [bidder2],
    });

    auctionAccount = await program.account.auction.fetch(auctionAddress);
    assert.equal(auctionAccount.highestBidder.toBase58(), bidder2.publicKey.toBase58());
    assert.equal(auctionAccount.highestBid, bid2);

    await program.rpc.makeBid(new anchor.BN(bid3), {
        accounts: {
          auction: auctionAddress,
          bidder: bidder1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [bidder1],
    });

    auctionAccount = await program.account.auction.fetch(auctionAddress);
    // highest bidder noted correctly
    assert.equal(auctionAccount.highestBidder.toBase58(), bidder1.publicKey.toBase58());
    assert.equal(auctionAccount.highestBid, bid1 + bid3);

    let postbid1 = await program.provider.connection.getBalance(bidder1.publicKey);
    let postbid2 = await program.provider.connection.getBalance(bidder2.publicKey);
    let postbidauction = await program.provider.connection.getBalance(auctionAddress);

    // bidder1 and bidder2 successfully transferred sol to auction account
    assert.equal(prebid1 - postbid1, bid1 + bid3);
    assert.equal(prebid2 - postbid2, bid2);
    assert.equal(postbidauction - prebidauction, bid1 + bid2 + bid3);

    await program.rpc.cancelAuction({
        accounts: {
          auction: auctionAddress,
          owner: auctioneer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [auctioneer],
    });

    await program.rpc.withdrawBid({
        accounts: {
          auction: auctionAddress,
          bidder: bidder2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [bidder2],
    });

    let postwithdraw2 = await program.provider.connection.getBalance(bidder2.publicKey);
    let postwithdrawauction = await program.provider.connection.getBalance(auctionAddress);
    // bidder2 withdrew their lower bid and didn't lose any sol
    assert.equal(postwithdraw2, initialBalance2);
    // auction still has the cumulative highest bid from bidder1
    assert.equal(postwithdrawauction - prebidauction, bid1 + bid3);

    await program.rpc.withdrawWinningBid({
        accounts: {
          auction: auctionAddress,
          owner: auctioneer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [auctioneer],
    });

    // owner got the cumulative highest bid
    let postwithdrawowner = await program.provider.connection.getBalance(auctioneer.publicKey);
    assert.equal(postwithdrawowner - prebidowner, bid1 + bid3);

    // auction account shouldnt be keeping any sol
    let postallwithdrawauction = await program.provider.connection.getBalance(auctionAddress);
    assert.equal(postallwithdrawauction, prebidauction);

  });

});