const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AgentReputation", function () {
    let AgentReputation, reputation;
    let owner, addr1, agent;

    beforeEach(async function () {
        AgentReputation = await ethers.getContractFactory("AgentReputation");
        [owner, addr1, agent] = await ethers.getSigners();

        reputation = await AgentReputation.deploy(owner.address);
        await reputation.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should set the right owner", async function () {
            expect(await reputation.owner()).to.equal(owner.address);
        });

        it("Should initialize with zero reputation for a new agent", async function () {
            const { totalSwaps, successSwaps } = await reputation.getReputation(agent.address);
            expect(totalSwaps).to.equal(0n);
            expect(successSwaps).to.equal(0n);
        });
    });

    describe("Recording Swaps", function () {
        it("Should record a successful swap", async function () {
            await expect(reputation.connect(owner).recordSwap(agent.address, true))
                .to.emit(reputation, "SwapRecorded")
                .withArgs(agent.address, true, 1n, 1n);

            const { totalSwaps, successSwaps } = await reputation.getReputation(agent.address);
            expect(totalSwaps).to.equal(1n);
            expect(successSwaps).to.equal(1n);
        });

        it("Should record a failed swap", async function () {
            await expect(reputation.connect(owner).recordSwap(agent.address, false))
                .to.emit(reputation, "SwapRecorded")
                .withArgs(agent.address, false, 1n, 0n);

            const { totalSwaps, successSwaps } = await reputation.getReputation(agent.address);
            expect(totalSwaps).to.equal(1n);
            expect(successSwaps).to.equal(0n);
        });

        it("Should revert if called by non-owner", async function () {
            await expect(
                reputation.connect(addr1).recordSwap(agent.address, true)
            ).to.be.revertedWithCustomError(reputation, "OwnableUnauthorizedAccount");
        });

        it("Should fail if the agent address is zero", async function () {
            await expect(
                reputation.connect(owner).recordSwap(ethers.ZeroAddress, true)
            ).to.be.revertedWith("AgentReputation: Agent address cannot be zero");
        });

        it("Should aggregate multiple swaps correctly", async function () {
            await reputation.connect(owner).recordSwap(agent.address, true);
            await reputation.connect(owner).recordSwap(agent.address, false);
            await reputation.connect(owner).recordSwap(agent.address, true);

            const { totalSwaps, successSwaps } = await reputation.getReputation(agent.address);
            expect(totalSwaps).to.equal(3n);
            expect(successSwaps).to.equal(2n);
        });
    });
});
