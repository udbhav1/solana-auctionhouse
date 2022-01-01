import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Auctionhouse } from '../target/types/auctionhouse';
import * as assert from "assert";

describe('auctionhouse', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  const program = anchor.workspace.Auctionhouse as Program<Auctionhouse>;

  it('can make auction', async () => {

    let title = "test title";
    let descrip = "test description";
    let floor = 100;
    let increment = 10;

    const auction = anchor.web3.Keypair.generate();
    await program.rpc.createAuction(title, descrip, new anchor.BN(floor), new anchor.BN(increment), {
        accounts: {
          auction: auction.publicKey,
          owner: program.provider.wallet.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [auction],
    });
    const auctionAccount = await program.account.auction.fetch(auction.publicKey);

  	assert.equal(auctionAccount.owner.toBase58(), program.provider.wallet.publicKey.toBase58());
    assert.ok(auctionAccount.startTime);
    assert.equal(auctionAccount.cancelled, false);
    assert.equal(auctionAccount.title, title);
    assert.equal(auctionAccount.description, descrip);
    assert.equal(auctionAccount.bidFloor, floor);
    assert.equal(auctionAccount.minBidIncrement, increment);
  });

  it('different wallet can make auction', async () => {

    // create new wallet and airdrop 1 sol in lamports
    const newUser = anchor.web3.Keypair.generate();
    const signature = await program.provider.connection.requestAirdrop(newUser.publicKey, 1000000000);
    await program.provider.connection.confirmTransaction(signature);

    let title = "test title";
    let descrip = "test description";
    let floor = 100;
    let increment = 10;

    const auction = anchor.web3.Keypair.generate();
    await program.rpc.createAuction(title, descrip, new anchor.BN(floor), new anchor.BN(increment), {
        accounts: {
          auction: auction.publicKey,
          owner: newUser.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        },
        signers: [newUser, auction],
    });
    const auctionAccount = await program.account.auction.fetch(auction.publicKey);

  	assert.equal(auctionAccount.owner.toBase58(), newUser.publicKey.toBase58());
    assert.ok(auctionAccount.startTime);
    assert.equal(auctionAccount.cancelled, false);
    assert.equal(auctionAccount.title, title);
    assert.equal(auctionAccount.description, descrip);
    assert.equal(auctionAccount.bidFloor, floor);
    assert.equal(auctionAccount.minBidIncrement, increment);
  });

  it('title just be less than 50 characters', async () => {
    try {
        const auction = anchor.web3.Keypair.generate();
        const longTitle = 'a'.repeat(51);
        await program.rpc.createAuction(longTitle, 'test description', new anchor.BN(100), new anchor.BN(10), {
            accounts: {
                auction: auction.publicKey,
                owner: program.provider.wallet.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            },
            signers: [auction],
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


});
