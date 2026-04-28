/**
 * FILE: MarginEngine.js
 * PLATFORM: Universal
 * PURPOSE: Automated Slab-Margin pricing logic for diesel parts to dynamically calculate retail prices from wholesale costs.
 * DEPENDENCIES: Vanilla JS
 */

export const MarginEngine = {
  /**
   * calculateRetail
   * @param {number|string} cost - The wholesale cost of the part 
   * @returns {number} The calculated retail price ending in .99
   */
  calculateRetail: (cost) => {
    const numCost = parseFloat(cost);
    if (isNaN(numCost) || numCost <= 0) return 0;

    let markup = 1.25; // Default 25% Markup (125% retail) for Major Parts ($1001+)

    // The "Slab" Logic
    if (numCost <= 50) {
      markup = 4.0;       // 300% Markup (400% retail) for Consumables
    } else if (numCost <= 200) {
      markup = 2.0;       // 100% Markup (200% retail) for Mid-Range
    } else if (numCost <= 1000) {
      markup = 1.5;       // 50% Markup (150% retail) for Heavy Parts
    }

    const retail = numCost * markup;
    
    // Round to the nearest .99 for the "Professional" look
    return Math.ceil(retail) - 0.01;
  },

  /**
   * getMarginPercentage
   * @param {number|string} cost - The wholesale cost
   * @param {number|string} retail - The final retail price (after overrides or slabs)
   * @returns {string} The gross margin percentage formatted to 2 decimals
   */
  getMarginPercentage: (cost, retail) => {
    const numCost = parseFloat(cost);
    const numRetail = parseFloat(retail);

    if (isNaN(numCost) || isNaN(numRetail) || numRetail <= 0) return "0.00";
    
    return (((numRetail - numCost) / numRetail) * 100).toFixed(2);
  }
};
