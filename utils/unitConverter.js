// Height conversions
function feetInchesToMm(feet, inches = 0) {
    const totalInches = feet * 12 + inches;
    return Math.round(totalInches * 25.4);
}

// function cmToMm(cm) {
//     return Math.round(cm * 10);
// }

// function mmToCm(mm) {
//     return (mm / 10).toFixed(1);
// }

function lbsToGrams(lbs) {
    return Math.round(lbs * 453.592);
}

function kgToGrams(kg) {
    return Math.round(kg * 1000);
}

module.exports = {
    feetInchesToMm,
    lbsToGrams,
    kgToGrams,
}
