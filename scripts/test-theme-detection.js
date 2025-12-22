// Test our theme detection logic against the actual violation text
const rawViolations = `10. ADEQUATE HANDWASHING SINKS PROPERLY SUPPLIED AND ACCESSIBLE - Comments: NO CONVENIENTLY ACCESSIBLE HAND WASH SINKS IN THE WEST SIDE UTENSIL WASHING AND FOOD PREP AREA, AND FAR REAR FOOD PREP (FRYER) AREA. MUST INSTALL HAND SINKS, SUPPLIED WITH HOT AND COLD RUNNING WATER UNDER CITY PRESSURE, AND STOCKED WITH HAND SOAP AND DISPOSABLE TOWELS IN SAID AREAS. PRIORITY FOUNDATION VIOLATION 7-38-030(C).`;

const lowerText = rawViolations.toLowerCase();
const foundThemes = [];

// Violation priority (lower = higher priority)
const VIOLATION_PRIORITY = {
  "toxic": 1,
  "pest": 2,
  "temperature": 3,
  "food handling": 4,
  "sanitation": 5,
  "water": 6,
  "hygiene": 7,
  "certification": 8,
};

// Check each theme
if (lowerText.includes('toxic') || lowerText.includes('chemical')) {
  foundThemes.push("toxic");
}
if (/\b(rodent|mouse|mice|rat|pest|insect|roach|fly|flies|droppings)\b/.test(lowerText)) {
  foundThemes.push("pest");
}
if (lowerText.includes('temperature') || lowerText.includes('cold holding') || lowerText.includes('hot holding')) {
  foundThemes.push("temperature");
}
if (lowerText.includes('cross contam') || lowerText.includes('raw meat')) {
  foundThemes.push("food handling");
}
if (/\b(clean|debris|soil|saniti|dirty)\b/.test(lowerText)) {
  foundThemes.push("sanitation");
}
// NEW: Only flag water issues for actual problems
if (lowerText.includes('sewage') || lowerText.includes('no hot water') || lowerText.includes('no water') || 
    lowerText.includes('water leak') || lowerText.includes('plumbing') || lowerText.includes('wastewater')) {
  foundThemes.push("water");
}
if (lowerText.includes('handwash') || lowerText.includes('hand wash') || lowerText.includes('hygiene')) {
  foundThemes.push("hygiene");
}
if (lowerText.includes('certificate') || lowerText.includes('license') || lowerText.includes('permit') || lowerText.includes('documentation')) {
  foundThemes.push("certification");
}

console.log('Found themes:', foundThemes);

// Sort by priority
foundThemes.sort((a, b) => {
  const priorityA = VIOLATION_PRIORITY[a] || 999;
  const priorityB = VIOLATION_PRIORITY[b] || 999;
  return priorityA - priorityB;
});

console.log('Sorted by priority:', foundThemes);
console.log('Primary theme (shown on card):', foundThemes[0] || 'none');

