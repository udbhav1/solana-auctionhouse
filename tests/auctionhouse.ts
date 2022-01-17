import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import * as splToken from '@solana/spl-token';
import * as serumAta from '@project-serum/associated-token'
import * as web3 from '@solana/web3.js';
import { Auctionhouse } from '../target/types/auctionhouse';
import * as assert from "assert";

function lamports(sol){
  return sol*anchor.web3.LAMPORTS_PER_SOL;
}

async function airdrop(program, address, lamports){
  const air = await program.provider.connection.requestAirdrop(address, lamports);
  await program.provider.connection.confirmTransaction(air);
}

async function getLamportBalance(program, address){
  let amt = await program.provider.connection.getBalance(address);
  return amt;
}

async function getTokenBalance(program, tokenAccountAddress){
  let res = await program.provider.connection.getTokenAccountBalance(tokenAccountAddress);
  return res.value;
}

async function deriveAuction(program, ownerAddress, mintAddress, auctionTitle){
  const [auctionAddress, bump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("auction"), ownerAddress.toBytes(), Buffer.from(auctionTitle.slice(0, 32))],
    program.programId
  )

  let auctionAta = await serumAta.getAssociatedTokenAddress(auctionAddress, mintAddress);
  return [auctionAddress, bump, auctionAta];
}

describe('auctionhouse', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  // @ts-ignore
  const program = anchor.workspace.Auctionhouse as Program<Auctionhouse>;

  let tempamt;

  it('can transfer nft', async () => {
    let seller = anchor.web3.Keypair.generate();
    let buyer = anchor.web3.Keypair.generate();
    let mintOwner = anchor.web3.Keypair.generate();

    await airdrop(program, seller.publicKey, lamports(5));
    await airdrop(program, buyer.publicKey, lamports(5));
    await airdrop(program, mintOwner.publicKey, lamports(5));

    let mint = await splToken.Token.createMint(
      program.provider.connection,
      mintOwner,
      mintOwner.publicKey,
      null,
      9,
      splToken.TOKEN_PROGRAM_ID,
    );

    let sellerTokenAccount = await mint.getOrCreateAssociatedAccountInfo(seller.publicKey);
    let buyerTokenAccount = await mint.getOrCreateAssociatedAccountInfo(buyer.publicKey);

    tempamt = await getTokenBalance(program, sellerTokenAccount.address);
    console.log("pre mint owner: ", tempamt);

    await mint.mintTo(sellerTokenAccount.address, mintOwner.publicKey, [], 1000000000);

    tempamt = await getTokenBalance(program, sellerTokenAccount.address);
    console.log("post mint owner: ", tempamt);

    let auctionTitle = "nft test";
    let floor = lamports(0.1);
    let increment = lamports(0.05);
    let biddercap = 2;
    let endtime = Math.floor(Date.now() / 1000) + 600;
    let amount = 1000000000;

    let [auctionAddress, bump, auctionAta] = await deriveAuction(program, seller.publicKey, mint.publicKey, auctionTitle);

    await program.rpc.createAuction(new anchor.BN(bump as any),
                                    auctionTitle,
                                    new anchor.BN(floor),
                                    new anchor.BN(increment),
                                    new anchor.BN(0),
                                    new anchor.BN(endtime),
                                    new anchor.BN(biddercap),
                                    new anchor.BN(amount), {
        accounts: {
          auction: auctionAddress,
          auctionAta: auctionAta,
          owner: seller.publicKey,
          ownerAta: sellerTokenAccount.address,
          mint: mint.publicKey,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          ataProgram: serumAta.ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rentSysvar: web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [seller],
    });

    tempamt = await getTokenBalance(program, sellerTokenAccount.address);
    console.log("post transfer owner: ", tempamt);

    tempamt = await getTokenBalance(program, auctionAta);
    console.log("post transfer auction: ", tempamt);
  });

  xit('two users can bid and then withdraw funds', async () => {

    console.log("started test")

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

    console.log("generated auctioneer account");

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

    console.log("made auction");

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

    console.log("made bidder accounts");

    await program.rpc.makeBid(new anchor.BN(bid1), {
        accounts: {
          auction: auctionAddress,
          bidder: bidder1.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [bidder1],
    });

    console.log("made bid 1");

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

    console.log("made bid 2");

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

    console.log("made bid 3");

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

    console.log("cancelled auction");

    await program.rpc.reclaimBid({
        accounts: {
          auction: auctionAddress,
          bidder: bidder2.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [bidder2],
    });

    console.log("reclaimed losing bid");

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

    console.log("withdrew winning bid");

    // owner got the cumulative highest bid
    let postwithdrawowner = await program.provider.connection.getBalance(auctioneer.publicKey);
    assert.equal(postwithdrawowner - prebidowner, bid1 + bid3);

    // auction account shouldnt be keeping any sol
    let postallwithdrawauction = await program.provider.connection.getBalance(auctionAddress);
    assert.equal(postallwithdrawauction, prebidauction);

    console.log("finished test");

  });

  xit('can fetch all auctions', async () => {
    const auctionAccounts = await program.account.auction.all();
    assert.equal(auctionAccounts.length, 4);
  });

});