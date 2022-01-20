import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import * as splToken from '@solana/spl-token';
import * as serumAta from '@project-serum/associated-token'
import * as web3 from '@solana/web3.js';
import { Auctionhouse } from '../target/types/auctionhouse';
import * as assert from "assert";

function lamports(sol: number): number{
  return sol*anchor.web3.LAMPORTS_PER_SOL;
}

function sol(lamports: number): number{
  return lamports/anchor.web3.LAMPORTS_PER_SOL;
}

function delay(interval){
   return it('delay for auction period to end', done => {
      setTimeout(() => done(), interval)
   }).timeout(interval + 100)
}

async function airdrop(program, address: web3.PublicKey, lamports: number){
  const air = await program.provider.connection.requestAirdrop(address, lamports);
  await program.provider.connection.confirmTransaction(air);
}

async function getLamportBalance(program, address: web3.PublicKey): Promise<number> {
  let amt = await program.provider.connection.getBalance(address);
  return amt;
}

async function getTokenBalance(program, tokenAccountAddress: web3.PublicKey): Promise<{
  amount: string,
  decimals: number,
  uiAmount: number,
  uiAmountString: number
}> {
  let res = await program.provider.connection.getTokenAccountBalance(tokenAccountAddress);
  return res.value;
}

async function deriveEnglishAuction(program,
  ownerAddress: web3.PublicKey,
  mintAddress: web3.PublicKey,
  auctionTitle: string
): Promise<[auctionAddress: web3.PublicKey, bump: number, auctionAta: web3.PublicKey]> {
  const [auctionAddress, bump] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("open auction"), ownerAddress.toBytes(), Buffer.from(auctionTitle.slice(0, 32))],
    program.programId
  )
  let auctionAta = await serumAta.getAssociatedTokenAddress(auctionAddress, mintAddress);
  return [auctionAddress, bump, auctionAta];
}

describe('english auction', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  // @ts-ignore
  const program = anchor.workspace.Auctionhouse as Program<Auctionhouse>;

  let seller;
  let loser;
  let buyer;
  let mintOwner;
  let decimals;
  let mintAmount;
  let mint;
  let sellerAta;
  let buyerAtaAddress;
  let auctionAddress;
  let bump;
  let auctionAta;
  let auctionAccount;
  let losingBid;
  let winningBid;

  let amt;

  it('init auction', async () => {
    seller = anchor.web3.Keypair.generate();
    loser = anchor.web3.Keypair.generate();
    buyer = anchor.web3.Keypair.generate();
    mintOwner = anchor.web3.Keypair.generate();

    await airdrop(program, seller.publicKey, lamports(5));
    await airdrop(program, loser.publicKey, lamports(5));
    await airdrop(program, buyer.publicKey, lamports(5));
    await airdrop(program, mintOwner.publicKey, lamports(5));

    decimals = 9;
    mintAmount = Math.pow(10, decimals);

    mint = await splToken.Token.createMint(
      program.provider.connection,
      mintOwner,
      mintOwner.publicKey,
      null,
      decimals,
      splToken.TOKEN_PROGRAM_ID,
    );

    sellerAta = await mint.getOrCreateAssociatedAccountInfo(seller.publicKey);
    // dont create the ata now so that the contract will do it in withdraw_item
    buyerAtaAddress = await serumAta.getAssociatedTokenAddress(buyer.publicKey, mint.publicKey);

    amt = await getTokenBalance(program, sellerAta.address);
    assert.equal(amt.amount, 0);

    await mint.mintTo(sellerAta.address, mintOwner.publicKey, [], mintAmount);

    amt = await getTokenBalance(program, sellerAta.address);
    assert.equal(amt.amount, mintAmount);

    let auctionTitle = "nft test";
    let floor = lamports(0.1);
    let increment = lamports(0.05);
    let biddercap = 2;
    let startTime = Math.floor(Date.now() / 1000) - 60;
    let endTime = Math.floor(Date.now() / 1000) + 5;
    let amount = mintAmount;

    [auctionAddress, bump, auctionAta] = await deriveEnglishAuction(program, seller.publicKey, mint.publicKey, auctionTitle);

    await program.rpc.createOpenAuction(new anchor.BN(bump),
                                    auctionTitle,
                                    new anchor.BN(floor),
                                    new anchor.BN(increment),
                                    new anchor.BN(startTime),
                                    new anchor.BN(endTime),
                                    new anchor.BN(biddercap),
                                    new anchor.BN(amount), {
        accounts: {
          auction: auctionAddress,
          auctionAta: auctionAta,
          owner: seller.publicKey,
          ownerAta: sellerAta.address,
          mint: mint.publicKey,
          tokenProgram: splToken.TOKEN_PROGRAM_ID,
          ataProgram: serumAta.ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rentSysvar: web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [seller],
    });

    amt = await getTokenBalance(program, sellerAta.address);
    assert.equal(amt.amount, 0);

    amt = await getTokenBalance(program, auctionAta);
    assert.equal(amt.amount, mintAmount);

    // amt = await getLamportBalance(program, seller.publicKey);
    // console.log(sol(lamports(5) - amt));
  });

  it('make losing bid', async () => {
    losingBid = lamports(1);
    let initialBalance = await getLamportBalance(program, auctionAddress);
    let loserBalance = await getLamportBalance(program, loser.publicKey);

    await program.rpc.makeBid(new anchor.BN(losingBid), {
      accounts: {
        auction: auctionAddress,
        bidder: loser.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [loser]
    });

    auctionAccount = await program.account.openAuction.fetch(auctionAddress);
    assert.equal(auctionAccount.highestBidder.toBase58(), loser.publicKey.toBase58());
    assert.equal(auctionAccount.highestBid, losingBid);

    amt = await getLamportBalance(program, auctionAddress);
    assert.equal(amt - initialBalance, losingBid);
    amt = await getLamportBalance(program, loser.publicKey);
    assert.equal(loserBalance - amt, losingBid);
  });

  it('make winning bid', async () => {
    winningBid = lamports(2);
    let initialBalance = await getLamportBalance(program, auctionAddress);
    let winnerBalance = await getLamportBalance(program, buyer.publicKey);

    await program.rpc.makeBid(new anchor.BN(winningBid), {
      accounts: {
        auction: auctionAddress,
        bidder: buyer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [buyer]
    });

    auctionAccount = await program.account.openAuction.fetch(auctionAddress);
    assert.equal(auctionAccount.highestBidder.toBase58(), buyer.publicKey.toBase58());
    assert.equal(auctionAccount.highestBid, winningBid);

    amt = await getLamportBalance(program, auctionAddress);
    assert.equal(amt - initialBalance, winningBid);
    amt = await getLamportBalance(program, buyer.publicKey);
    assert.equal(winnerBalance - amt, winningBid);
  });

  it('reclaim losing bid', async () => {
    let initialBalance = await getLamportBalance(program, loser.publicKey);

    await program.rpc.reclaimBid({
      accounts: {
        auction: auctionAddress,
        bidder: loser.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [loser]
    });

    amt = await getLamportBalance(program, loser.publicKey);
    assert.equal(amt - initialBalance, losingBid);
  });

  xit('cancel auction', async () => {
    await program.rpc.cancelAuction({
      accounts: {
        auction: auctionAddress,
        owner: seller.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [seller]
    });

    auctionAccount = await program.account.openAuction.fetch(auctionAddress);
    assert.equal(auctionAccount.cancelled, true);
  });

  delay(6000);

  it('withdraw winning bid', async () => {
    let initialBalance = await getLamportBalance(program, seller.publicKey);

    await program.rpc.withdrawWinningBid({
      accounts: {
        auction: auctionAddress,
        owner: seller.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      },
      signers: [seller]
    });

    amt = await getLamportBalance(program, seller.publicKey);
    assert.equal(amt - initialBalance, winningBid);
  });

  it('withdraw winner spl tokens', async () => {
    await program.rpc.withdrawItem({
      accounts: {
        auction: auctionAddress,
        auctionAta: auctionAta,
        highestBidder: buyer.publicKey,
        highestBidderAta: buyerAtaAddress,
        mint: mint.publicKey,
        tokenProgram: splToken.TOKEN_PROGRAM_ID,
        ataProgram: serumAta.ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rentSysvar: web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [buyer]
    });

    amt = await getTokenBalance(program, buyerAtaAddress);
    assert.equal(amt.amount, mintAmount);
  });

  it('fetch auction', async () => {
    const auctionAccounts = await program.account.openAuction.all();
    assert.equal(auctionAccounts.length, 1);
  });

});