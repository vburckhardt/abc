// Liste des mots (chacun avec une image, un enfant ne sait pas encore lire).
// Pour ajouter un mot : { mot: "CHAT", emoji: "🐱" }, puis augmenter
// APP_VERSION dans version.js.
// - famille: true => catégorie « Famille » ; sinon la catégorie dépend de la
//   longueur (courts : 3-4 lettres, moyens : 5-6, longs : 7+).
// - dire: "…" (facultatif) => orthographe donnée à la voix si le mot est mal
//   prononcé (noms propres).
window.MOTS = [
  // Famille
  { mot: "LÉO", emoji: "👦", famille: true },
  { mot: "PAPA", emoji: "👨", famille: true },
  { mot: "MAMAN", emoji: "👩", famille: true },
  { mot: "BURCKHARDT", emoji: "👨‍👩‍👦", famille: true, dire: "burkarte" },

  // Animaux
  { mot: "CHAT", emoji: "🐱" },
  { mot: "RAT", emoji: "🐀" },
  { mot: "LOUP", emoji: "🐺" },
  { mot: "OURS", emoji: "🐻" },
  { mot: "LION", emoji: "🦁" },
  { mot: "CHIEN", emoji: "🐶" },
  { mot: "VACHE", emoji: "🐮" },
  { mot: "LAPIN", emoji: "🐰" },
  { mot: "POULE", emoji: "🐔" },
  { mot: "SINGE", emoji: "🐵" },
  { mot: "TIGRE", emoji: "🐯" },
  { mot: "ZÈBRE", emoji: "🦓" },
  { mot: "CANARD", emoji: "🦆" },
  { mot: "COCHON", emoji: "🐷" },
  { mot: "MOUTON", emoji: "🐑" },
  { mot: "CHEVAL", emoji: "🐴" },
  { mot: "TORTUE", emoji: "🐢" },
  { mot: "POISSON", emoji: "🐟" },
  { mot: "SERPENT", emoji: "🐍" },

  // Véhicules
  { mot: "BUS", emoji: "🚌" },
  { mot: "TAXI", emoji: "🚕" },
  { mot: "MOTO", emoji: "🏍️" },
  { mot: "VÉLO", emoji: "🚲" },
  { mot: "TRAIN", emoji: "🚂" },
  { mot: "AVION", emoji: "✈️" },
  { mot: "BATEAU", emoji: "⛵" },
  { mot: "CAMION", emoji: "🚚" },
  { mot: "FUSÉE", emoji: "🚀" },

  // À manger
  { mot: "RIZ", emoji: "🍚" },
  { mot: "BOL", emoji: "🥣" },
  { mot: "PAIN", emoji: "🥖" },
  { mot: "LAIT", emoji: "🥛" },
  { mot: "POMME", emoji: "🍎" },
  { mot: "POIRE", emoji: "🍐" },
  { mot: "PIZZA", emoji: "🍕" },
  { mot: "GLACE", emoji: "🍦" },
  { mot: "BANANE", emoji: "🍌" },
  { mot: "FRAISE", emoji: "🍓" },
  { mot: "CITRON", emoji: "🍋" },
  { mot: "TOMATE", emoji: "🍅" },
  { mot: "GÂTEAU", emoji: "🎂" },
  { mot: "CAROTTE", emoji: "🥕" },

  // Nature
  { mot: "MER", emoji: "🌊" },
  { mot: "FEU", emoji: "🔥" },
  { mot: "EAU", emoji: "💧" },
  { mot: "LUNE", emoji: "🌙" },
  { mot: "FLEUR", emoji: "🌷" },
  { mot: "ARBRE", emoji: "🌳" },
  { mot: "SOLEIL", emoji: "☀️" },
  { mot: "ÉTOILE", emoji: "⭐" },

  // Objets et corps
  { mot: "LIT", emoji: "🛏️" },
  { mot: "SAC", emoji: "🎒" },
  { mot: "NEZ", emoji: "👃" },
  { mot: "CLÉ", emoji: "🔑" },
  { mot: "MAIN", emoji: "✋" },
  { mot: "PIED", emoji: "🦶" },
  { mot: "DENT", emoji: "🦷" },
  { mot: "ROI", emoji: "🤴" },
  { mot: "FÉE", emoji: "🧚" },
  { mot: "LIVRE", emoji: "📖" },
  { mot: "ROBOT", emoji: "🤖" },
  { mot: "BALLON", emoji: "🎈" },
  { mot: "MAISON", emoji: "🏠" },
  { mot: "CADEAU", emoji: "🎁" },
];
