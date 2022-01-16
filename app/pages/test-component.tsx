import { WalletNotConnectedError } from '@solana/wallet-adapter-base';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair, SystemProgram, Transaction, PublicKey } from '@solana/web3.js';
// import { getParsedNftAccountsByOwner } from '@nfteyez/sol-rayz';
import { useWalletNfts } from "@nfteyez/sol-rayz-react";
import * as metadata from "@metaplex-foundation/mpl-token-metadata";
import React, { FC, useState, useEffect, useCallback } from 'react';

export const NFTGallery: FC = () => {
    const { connection } = useConnection();
    const { publicKey, sendTransaction } = useWallet();
    const [ collection, setCollection ] = useState<any[]>([]);

    useEffect(() => {
        async function updateCollection(){
            // @ts-ignore
            const nftmetadata: metadata.MetadataData[] = await metadata.Metadata.findDataByOwner(connection, publicKey);
            let info = [];
            console.log(nftmetadata);
            for(let nft of nftmetadata){
                let r = await fetch(nft.data.uri).then(s => s.json());
                info.push( {name: r.name, description: r.description, image: r.image, mint: nft.mint} );
            }
            setCollection(info);
        }
        updateCollection();
    }, []);

    const onClick = useCallback(async () => {
        if (!publicKey) throw new WalletNotConnectedError();
        
        console.log(collection);
        // const transaction = new Transaction().add(
        //     SystemProgram.transfer({
        //         fromPubkey: publicKey,
        //         toPubkey: Keypair.generate().publicKey,
        //         lamports: 1,
        //     })
        // );
        // const signature = await sendTransaction(transaction, connection);
        // console.log("SIGNATURE: ", signature);
        // await connection.confirmTransaction(signature, 'processed');
    }, [publicKey, sendTransaction, connection]);

    return (
        <div>
            <div>
                {
                    collection.map(nft => (
                        <div key={nft.mint} className="imagecontainer">
                            <img src={nft.image} key={nft.image} className="nftimage"></img>
                        </div>
                    ))
                }
            </div>
            <button onClick={onClick} disabled={!publicKey}>
                View NFTs
            </button>
        </div>
    );
};