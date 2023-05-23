import { ethers, upgrades, network } from "hardhat";
import {
  proxies,
  TablelandNetworkConfig,
} from "@tableland/evm/network";

async function main() {
  // Get the Tableland registry address for the current network
  const registryAddress =
    network.name === "localhost"
      ? proxies["local-tableland" as keyof TablelandNetworkConfig]
      : proxies[network.name as keyof TablelandNetworkConfig];
  // Get the baseURI with only the endpoint `/api/v1/` instead of an appended `/tables`

  if (!registryAddress)
    throw new Error("cannot get registry address for " + network.name);

  // Deploy the DaoCloud contract.
  const DaoCloud = await ethers.getContractFactory("DaoCloud");
  const daoCloud = await upgrades.deployProxy(
    DaoCloud,
    [],
    {
      kind: "uups",
    }
  );
  await daoCloud.deployed();
  // Check upgradeability.
  console.log("Proxy deployed to:", daoCloud.address, "on", network.name);
  const impl = await upgrades.erc1967.getImplementationAddress(
    daoCloud.address
  );
  console.log("^Add this to your 'hardhat.config.ts' file's 'deployments'");
  console.log("New implementation address:", impl);

  // Run post deploy table creation.
  console.log("\nRunning post deploy...");
  // Create our metadata table
  let tx = await daoCloud.createTable();
  let receipt = await tx.wait();

  // For fun—test minting and making a move.
  const accounts = await ethers.getSigners();
  tx = await daoCloud.connect(accounts[0]).touch("/test/test.txt", "test.txt", "http://localhost:3000/");
  receipt = await tx.wait();
  tx = await daoCloud.connect(accounts[0]).touch("/test/test2.txt", "test2.txt", "http://localhost:3000/");
  receipt = await tx.wait();

  tx = await daoCloud.connect(accounts[0])['mv(string,string,string)']("/test/test2.txt", "/test2/test2.txt", "test2.txt");
  receipt = await tx.wait();

  tx = await daoCloud.connect(accounts[0])['mv(string,string)']("/test/", "/test3/");
  receipt = await tx.wait();

  tx = await daoCloud.connect(accounts[0]).rm('/test2')
  receipt = await tx.wait();

  // Query all table values after mutating.
  // Note the `makeMove` method's SQL:
  // UPDATE daocloud_{chainId}_{tokenId} SET x = ${x}, y = ${y} WHERE id = ${tokenId};
  // await daoCloud
  //   .connect(accounts[0])
  //   .makeMove(ethers.BigNumber.from(tokenId).toNumber(), 10, 10); // (tokenId, x, y)
  // await tx.wait();

  console.log('http://localhost:8080/api/v1/query?statement=SELECT%20*%20FROM%20daocloud_31337_2')
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
