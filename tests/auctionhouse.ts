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

    tempamt = await getLamportBalance(program, seller.publicKey);
    console.log(tempamt);
  });

  xit('can fetch all auctions', async () => {
    const auctionAccounts = await program.account.auction.all();
    assert.equal(auctionAccounts.length, 4);
  });

});