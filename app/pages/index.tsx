import type { NextPage } from 'next';
import { WalletDisconnectButton, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Head from 'next/head';
import Image from 'next/image';
import styles from '../styles/Home.module.css';

const Home: NextPage = () => {
    return (
        <div className={styles.container}>
            <main className={styles.main}>
                <div className={styles.walletButtons}>
                    <WalletMultiButton />
                    <WalletDisconnectButton />
                </div>
            </main>
        </div>
    );
};

export default Home;
