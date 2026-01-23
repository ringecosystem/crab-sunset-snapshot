import { readFileSync } from "fs";
import { resolve } from "path";
import { ethers } from "ethers";
import fs from 'fs'
import path from 'path'

type InputItem = { address: string };

type LPInfo = {
  address: string;
  totalBalance: number;
  totalSupply: number;
  lpBalance: number;
  amount: number;
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
];

const FETCH_ABI = [
  "function getBalance(address token, address[] calldata accounts) external view returns((address,uint256,bool)[])",
];

/** ====== 配置 ====== */
const RPC_URL = process.env.RPC_URL || "https://crab-rpc.darwinia.network";
const INPUT_JSON_PATH = process.env.INPUT_JSON_PATH || "./accounts.json";

const XRING_ADDRESS = process.env.XRING_ADDRESS || "0x7399Ea6C9d35124d893B8d9808930e9d3F211501";
const XWRING_ADDRESS = process.env.XWRING_ADDRESS || "0x273131F7CB50ac002BDd08cA721988731F7e1092";
/** ================== */

function loadAndDedupeAddresses(filePath: string): string[] {
  const fullPath = resolve(filePath);
  const raw = readFileSync(fullPath, "utf-8");
  const parsed = JSON.parse(raw) as InputItem[];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of parsed) {
    const addr = item?.address?.trim();
    if (!addr) continue;
    if (!ethers.isAddress(addr)) continue;

    const lower = addr.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    out.push(ethers.getAddress(lower)); // checksum 标准化
  }
  return out;
}

async function main() {
  if (!RPC_URL || RPC_URL.includes("YOUR_RPC_HERE")) {
    throw new Error("请设置 RPC_URL（环境变量或脚本内常量）。");
  }
  if (!ethers.isAddress(XRING_ADDRESS) || !ethers.isAddress(XWRING_ADDRESS)) {
    throw new Error("请设置正确的 XRING_ADDRESS / XWRING_ADDRESS。");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  const addresses = loadAndDedupeAddresses(INPUT_JSON_PATH);
  console.log(`Loaded ${addresses.length} unique addresses.\n`);

  const xring = new ethers.Contract(XRING_ADDRESS, ERC20_ABI, provider);
  const xwring = new ethers.Contract(XWRING_ADDRESS, ERC20_ABI, provider);
  const fetchBalanceContract = new ethers.Contract("0x2cBD2396C2A00DB5f7187915b8FB13349ff5B968", FETCH_ABI, provider);

  const xringDecimals: number = 9;
  const xringSymbol: string = "xring";
  const xwringDecimals: number = 18;
  const xwringSymbol: string = "xwring";

  const xringBalances = await fetchBalanceContract.getBalance(XRING_ADDRESS, addresses);
  const xwringBalances = await fetchBalanceContract.getBalance(XWRING_ADDRESS, addresses);

  let accounts = [];
  for (const xringBalance of xringBalances) {
      const [account, balance, isEOA] = xringBalance;
      const amount = ethers.formatUnits(balance, xringDecimals);
      accounts.push({
          account,
          xring: balance,
          xwring: 0n,
          amount: Number(amount),
          isEOA,
          lp: [] as LPInfo[],
      });
  }
  for (const xwringBalance of xwringBalances) {
      const [account, balance, isEOA] = xwringBalance;
      const amount = ethers.formatUnits(balance, xwringDecimals);
      const exist = accounts.find(a => a.account === account);
      if (exist) {
          exist.xwring = balance;
          exist.amount += Number(amount);
      } else {
          accounts.push({
              account,
              xring: 0n,
              xwring: balance,
              amount: Number(amount),
              isEOA,
              lp: [] as LPInfo[],
          });
      }
  }
  const contractAccounts = accounts.filter(a => !a.isEOA);
  let totalLpFind = 0;
  for (const account of contractAccounts) {
      try {
          const lpToken = new ethers.Contract(account.account, ERC20_ABI, provider);
          const symbol = await lpToken.symbol();
          if (symbol !== 'SNOW-LP') continue;
          const totalSupply = await lpToken.totalSupply();
          if (totalSupply <= 0n) continue;
          const lpBalances = await fetchBalanceContract.getBalance(account.account, addresses);
          for (let i = 0; i < lpBalances.length; i++) {
              const lpBalance = lpBalances[i][1];
              const accountInfo = accounts[i];
              if (!accountInfo.isEOA) continue;
              const amount = account.amount * Number(lpBalance) / Number(totalSupply);
              if (amount <= 0) continue;
              accountInfo.lp.push({
                  address: account.account,
                  totalBalance: account.amount,
                  totalSupply,
                  lpBalance,
                  amount,
              });
              accountInfo.amount += amount;
              totalLpFind += amount;
          }
      } catch(err) {
          //console.log(err);
      }
  }

  accounts.sort((a, b) => {
      if (a.isEOA && !b.isEOA) return 1;
      else if (!a.isEOA && b.isEOA) return -1;
      return a.amount - b.amount;
  });
  accounts = accounts.filter(a => a.amount > 0);
  let totalXRING = 0n;
  let totalXWRING = 0n;
  let totalEOAAmount = 0;
  let totalContractAmount = 0;
  let totalAmount = 0;
  for (const account of accounts) {
      console.log(account);
      totalXRING += account.xring;
      totalXWRING += account.xwring;
      totalAmount += account.amount;
      if (account.isEOA) totalEOAAmount += account.amount;
      else totalContractAmount += account.amount;
  }
  const jsonString = JSON.stringify({
      statistics: {
          TotalXRING: totalXRING,
          TotalXWRING: totalXWRING,
          TotalEOA: totalEOAAmount,
          TotalLP: totalLpFind,
          TotalContract: totalContractAmount,
          Total: totalAmount - totalLpFind,
      },
      details: accounts,
  }, (_, value) => typeof value === "bigint" ? value.toString() : value, 2);
  const filePath = path.resolve(__dirname, 'airdrop_xwring.json')
  fs.writeFileSync(filePath, jsonString, 'utf-8');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

