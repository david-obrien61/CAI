export const MarginEngine = {
  calculateRetail: (cost) => {
    const numCost = parseFloat(cost);
    if (isNaN(numCost)) return 0;

    let markup = 1.25; // Default 25%

    if (numCost <= 50) markup = 4.0;      // 300% Markup
    else if (numCost <= 200) markup = 2.0; // 100% Markup
    else if (numCost <= 1000) markup = 1.5; // 50% Markup

    const retail = numCost * markup;

    // Round to the nearest .99 for that "Professional" look
    return Math.ceil(retail) - 0.01;
  },

  getProfitMargin: (cost, retail) => {
    return ((retail - cost) / retail * 100).toFixed(2);
  }
};