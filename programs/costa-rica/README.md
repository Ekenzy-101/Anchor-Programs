# COSTA RICA PROGRAM

The contract itself should have 4 functions

1. (create) account with basic parameters
2. (transfer) sol from external waller to smart contract account
3. (pay) transfer/airdrops sol from account to an chosen wallet
4. (balance) check smart contract account balance

Security considerations:

- Create only allowed for main client
- Anyone can transfer to account only if it was init with that wallet address
- Pay can only be executed by the client
- Balance can be executed by anyone

Use case:

- User A connects wallet to an account and deposits a pre given value. example 2 sol
- User B connects wallet and does the same as A
- Only this two users can transfer sol to the account since , the client created with their address on initialization (wallet addresses probably obtained before)

A program will decide who to deposit to based on certain conditions, but for this example the payout function can receive the address to deposit / airdrop to.
