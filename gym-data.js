/**
 * Gym Data Module
 * Static data: standardized exercise database grouped by muscle + quote collection.
 * Pure data, no state. Never mutated at runtime (custom exercises live in GymStore).
 */

const GymData = (() => {

  const EXERCISES = {
    Chest: [
      'Barbell Bench Press',
      'Dumbbell Bench Press',
      'Incline Barbell Bench Press',
      'Incline Dumbbell Press',
      'Low Cable Crossover',
      'Dumbbell Chest Fly',
      'Machine Chest Fly',
      'Incline Dumbbell Fly'
    ],
    Back: [
      'Single-Arm Dumbbell Row',
      'Barbell Row',
      'Seated Cable Row',
      'Lat Pulldown (Overhand Grip)',
      'Lat Pulldown (Reverse Grip)',
      'Straight-Arm Pulldown'
    ],
    Shoulders: [
      'Dumbbell Overhead Press',
      'Barbell Overhead Press',
      'Arnold Press',
      'Military Press',
      'Single-Arm Dumbbell Lateral Raise',
      'Single-Arm Cable Lateral Raise',
      'Upright Row',
      'Dumbbell Lateral Raise',
      'Reverse Pec Deck Fly',
      'Face Pull'
    ],
    Biceps: [
      '21s Curl (7-7-7)',
      'Dumbbell Curl',
      'Barbell Curl',
      'EZ Bar Curl',
      'Cable Curl',
      'Hammer Curl',
      'Reverse Curl',
      'Concentration Curl',
      'Preacher Curl'
    ],
    Triceps: [
      'Cable Overhead Extension',
      'Single-Arm Cable Overhead Extension',
      'Dumbbell Overhead Extension',
      'EZ Bar Skull Crusher',
      'Cable Pushdown',
      'Dumbbell Kickback',
      'Cable Kickback',
      'Single-Arm Pushdown',
      'Reverse-Grip Pushdown'
    ],
    Legs: [
      'Leg Extension',
      'Leg Press',
      'Barbell Squat',
      'Walking Lunge',
      'Barbell Romanian Deadlift',
      'Dumbbell Romanian Deadlift',
      'Lying Leg Curl',
      'Standing Calf Raise',
      'Seated Calf Raise'
    ]
  };

  const MUSCLES = Object.keys(EXERCISES);

  const QUOTES = [
    'What hurts today makes you stronger tomorrow.',
    'Discipline weighs ounces. Regret weighs tons.',
    'No one is coming to save you.',
    'The bar doesn\'t care about excuses.',
    'Come back with your shield, or on it.',
    'You are only as strong as the days you did not want to show up.',
    'Sweat dries. Blood clots. Bones heal. Suck it up.',
    'The obstacle in the way becomes the way.',
    'Motivation is a guest. Discipline lives here.',
    'A Spartan is not made on the day of battle.',
    'Comfort is the enemy you never see coming.',
    'You do not rise to the occasion. You fall to your training.',
    'Small weights, moved often, build unbreakable men.',
    'Nobody remembers the sets you skipped. Your body does.',
    'Do the hard thing while it is still hard.',
    'Strength is a habit before it is a result.',
    'Rest if you must, but do not quit the sequence.',
    'The iron never lies to you.',
    'Win the morning and the day surrenders.',
    'Be tolerant with others and strict with yourself.',
    'One more rep is a decision, not a talent.',
    'Train so that hardship feels familiar.'
  ];

  /** Deterministic quote-of-the-day: same all day, changes at midnight. */
  const getDailyQuote = (dateKey) => {
    const key = dateKey || new Date().toISOString().slice(0, 10);
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    }
    return QUOTES[Math.abs(hash) % QUOTES.length];
  };

  return { EXERCISES, MUSCLES, QUOTES, getDailyQuote };
})();
