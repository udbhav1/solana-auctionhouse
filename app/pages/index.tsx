import type { NextPage } from 'next';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Head from 'next/head';
import Image from 'next/image';
import styles from '../styles/Home.module.css';
import { NFTGallery } from './test-component';

const Home: NextPage = () => {
    const { publicKey } = useWallet();
    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <div className={styles.walletButtons}>
                    <WalletMultiButton />
                    <WalletDisconnectButton />
                    {publicKey && <NFTGallery /> }
                </div>
            </main>
        </div>
    );
};

export default Home;
