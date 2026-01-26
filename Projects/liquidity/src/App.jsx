class LiquidityPool {
    constructor(tokenA_reserve, tokenB_reserve) {
        this.tokenA_reserve = tokenA_reserve;
        this.tokenB_reserve = tokenB_reserve;
        this.k = tokenA_reserve * tokenB_reserve;
    }

    swapAforB(amountIn) {
        const fee = amountIn * 0.003;
        amountIn -= fee;

        const newTokenA_reserve = this.tokenA_reserve + amountIn;
        const newTokenB_reserve = this.k / newTokenA_reserve;
        const amountOut = this.tokenB_reserve - newTokenB_reserve;

        // Update reserves
        this.tokenA_reserve = newTokenA_reserve;
        this.tokenB_reserve = newTokenB_reserve;
        this.k = newTokenA_reserve * newTokenB_reserve; // Recalculate k (should remain close to constant)

        return amountOut;
    }

    /**
     * Calculates the current price (exchange rate) of Token A in terms of Token B
     * @returns {number} Price of A (how much B you get for 1 A)
     */
    getPriceA() {
        return this.tokenB_reserve / this.tokenA_reserve;
    }

    /**
     * Provides current pool status
     * @returns {object} Current reserves and constant product
     */
    getStatus() {
        return {
            TokenA: this.tokenA_reserve,
            TokenB: this.tokenB_reserve,
            K: this.k
        };
    }
}

const initialA = 1000;
const initialB = 10000;
const uniswapPool = new LiquidityPool(initialA, initialB);

console.log("Initial Pool Status:", uniswapPool.getStatus());
console.log("Initial Price of Token A (in B):", uniswapPool.getPriceA());

const swapAmount = 100; 
const amountReceived = uniswapPool.swapAforB(swapAmount);

console.log(`\nSwapped ${swapAmount} Token A, Received ${amountReceived.toFixed(2)} Token B`);
console.log("New Pool Status:", uniswapPool.getStatus());
console.log("New Price of Token A (in B):", uniswapPool.getPriceA());
