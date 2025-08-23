import { ethers } from "ethers";
import gameAbi from "../contracts/artifacts/OceanGameController.json" assert { type: "json" };

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const backendSigner = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);

const gameContract = new ethers.Contract(
  process.env.GAME_CONTRACT_ADDRESS,
  gameAbi.abi,
  backendSigner
);

export async function claimTokens(userAddress, amount, signature) {
  // Calls the claim function on the contract
  const tx = await gameContract.claim(userAddress, amount, signature);
  await tx.wait();
  return tx.hash;
}
