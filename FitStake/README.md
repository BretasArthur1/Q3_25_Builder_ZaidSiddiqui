# FitStake

**FitStake** is a decentralized platform that enables users to financially commit to their fitness goals by staking SOL. 

---

## Table of Contents

- [Overview](#overview)  
- [Features](#features)  
- [Usage](#usage)  
- [Architecture](#architecture)
- [Program Instructions](#program-instructions)  

---

## Overview

FitStake allows **self-driven individuals and crypto-native users** to stay consistent with fitness goals through financial incentives:

- Users stake SOL on personal fitness goals.  
- Completion returns the stake to the user.  
- Failure sends staked tokens to a charity chosen by the user.  

The program is built on **Solana using Anchor**, combining on-chain escrow for token staking with off-chain data storage.

---

## Features

- **User Accounts**: Wallet-based account creation.  
- **Goal Management**: Create, track, and mark fitness goals.  
- **SOL Staking**: Secure escrow of user tokens per goal.  
- **Forfeiture to Charity**: Automatic donation on missed goals.  
- **Referrals**: Keeps track of people who joined using your referral code

---

## Program Instructions

| Instruction          | Description                                                   |
|----------------------|---------------------------------------------------------------|
| `init_user`    | Create a user account and link wallet.                        |
| `init_goal`| Create a new goal with metadata and lock stake amount.             |
| `init_referral`       | Create a referral account for a user.             |
| `init_charity` | Create a new account for a charity with its description       |
| `complete_goal`      | Send staked tokens back to the user upon completion.         |
| `forfeit_goal` | Transfer tokens to the selected charity if goal is missed.   |
