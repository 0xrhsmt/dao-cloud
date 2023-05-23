import { after, before, describe, test } from "mocha";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ethers, upgrades } from "hardhat";
import {
  getAccounts,
  getRegistry,
  getDatabase,
  LocalTableland,
} from "@tableland/local";

chai.use(chaiAsPromised);
const expect = chai.expect;

// Create an instance of Local Tableland.
const lt = new LocalTableland({
  // Silent or verbose can be set via an options object as the first arg.
  silent: true,
});
const accounts = getAccounts();
let daoCloud: any;

before(async function () {
  this.timeout(25000);
  lt.start();
  await lt.isReady();

  const DaoCloud = await ethers.getContractFactory("DaoCloud");
  daoCloud = await upgrades.deployProxy(
    DaoCloud,
    ["http://localhost:8080/api/v1/", "not.implemented.com"],
    {
      kind: "uups",
    }
  );
  await daoCloud.deployed();
  await daoCloud.connect(accounts[0]).createTable();

  await new Promise((resolve) => setTimeout(() => resolve(0), 5000));
});

after(async function () {
  await lt.shutdown();
});

describe("DaoCloud", async function () {
  test("Should allow minting", async function () {
    const tx = await daoCloud
      .connect(accounts[0])
      .safeMint(accounts[0].address);

    const receipt = await tx.wait();
    const [, transferEvent] = receipt.events ?? [];
    const tokenId1 = transferEvent.args!.tokenId;

    const tx2 = await daoCloud
      .connect(accounts[1])
      .safeMint(accounts[1].address);

    const receipt2 = await tx2.wait();
    const [, transferEvent2] = receipt2.events ?? [];
    const tokenId2 = transferEvent2.args!.tokenId;

    await expect(tokenId1).to.equal(0);
    await expect(tokenId2).to.equal(1);
  });

  test("Should make contract owner of the table", async function () {
    const registry = getRegistry(accounts[0]);
    const tables = await registry.listTables();

    expect(tables.length).to.be.greaterThan(0);
  });

  test("Should allow making a move", async function () {
    // mint the token
    let tx = await daoCloud
      .connect(accounts[1])
      .safeMint(accounts[1].address);

    let receipt = await tx.wait();
    const [, transferEvent] = receipt.events ?? [];
    const tokenId = transferEvent.args!.tokenId;
    const x = 10;
    const y = 10;
    // const statement = `UPDATE daocloud_31337_2 SET x = ${x}, y = ${y} WHERE id = ${tokenId};`;

    tx = await daoCloud.connect(accounts[1]).makeMove(tokenId, 10, 10);
    receipt = await tx.wait();
    let [, makeMoveEvent] = (await receipt.events) ?? [];
    expect(makeMoveEvent.args!.caller).to.equal(accounts[1].address);
    expect(makeMoveEvent.args!.tokenId).to.equal(
      ethers.BigNumber.from(tokenId)
    );
    expect(makeMoveEvent.args!.x).to.equal(ethers.BigNumber.from(x));
    expect(makeMoveEvent.args!.y).to.equal(ethers.BigNumber.from(y));
  });
});
