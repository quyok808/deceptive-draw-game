const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const PORT = 3001;

let players = [];
let deck = [];
let turnIndex = 0;
let requiredCard = "Q";
let hands = {}; // tay bài
let lastPlay = null; // lưu lượt gần nhất
let currentPlayerId = null;
let shooterIdLastRound = null;
let playerShootCount = {};
let gameStarted = false;

function addBot(name = `bot_${Date.now()}`) {
  const id = `bot_${Date.now()}`;
  players.push({ id, name, alive: true, isBot: true });
  hands[id] = [];
}

function shuffleDeck() {
  const cards = [
    ...Array(6).fill("Q"),
    ...Array(6).fill("K"),
    ...Array(6).fill("A"),
    ...Array(2).fill("JOKER")
  ];
  return cards.sort(() => Math.random() - 0.5);
}

function dealCards(deck) {
  hands = {};
  players.forEach((p) => {
    hands[p.id] = deck.splice(0, 5);
  });

  console.log("=== Hands after dealing ===");
  Object.entries(hands).forEach(([id, cards]) => {
    console.log(`${id} => ${cards.join(", ")}`);
  });
  return hands;
}

function getNextPlayerId(fromId) {
  const alive = players.filter((p) => p.alive);
  if (alive.length === 1) {
    io.emit("gameOver", { winner: alive[0] });
    return null;
  }

  let idx = players.findIndex((p) => p.id === fromId);
  do {
    idx = (idx + 1) % players.length;
  } while (!players[idx].alive);

  return players[idx].id;
}

function resetRound() {
  io.emit("freeze", false);
  deck = shuffleDeck();
  hands = dealCards(deck);

  requiredCard = ["Q", "K", "A"][Math.floor(Math.random() * 3)];

  // Gửi tay bài cho người còn sống
  players.forEach((p) => {
    if (p.alive) {
      io.to(p.id).emit("updateHand", hands[p.id]);
    }
  });

  io.emit("clearPlayedCards");

  // 🔁 Xác định người bắn vừa rồi sẽ đi trước
  let startIndex = players.findIndex(
    (p) => p.id === shooterIdLastRound && p.alive
  );

  if (startIndex === -1) {
    // nếu người bắn đã chết, chọn người sống đầu tiên
    startIndex = players.findIndex((p) => p.alive);
  }

  turnIndex = startIndex;
  currentPlayerId = players[turnIndex].id;

  io.emit("startNewRound", {
    requiredCard,
    currentPlayerId
  });

  io.emit("players", players);

  lastPlay = null;

  // ✅ GỌI botPlayTurn nếu là bot
  if (isBot(currentPlayerId)) {
    setTimeout(() => botPlayTurn(currentPlayerId), 2000);
  }
}

function isOnlyPlayerWithCards(currentId) {
  const currentPlayer = players.find((p) => p.id === currentId);
  const others = players.filter((p) => p.id !== currentId && p.alive);

  const currentHasCards = hands[currentId]?.length > 0;
  const othersEmpty = others.every((p) => (hands[p.id]?.length || 0) === 0);
  const lastPlayedEmpty = hands[lastPlay?.playerId]?.length === 0;

  return currentHasCards && othersEmpty && lastPlayedEmpty;
}

function isBot(id) {
  return id.startsWith("bot_");
}

function handleCatchByBot(botId) {
  console.log(`[BOT] Bắt người, botId = ${botId} bắt ${lastPlay?.playerId}`);
  if (!lastPlay) return;
  io.emit("freeze", true);
  const catcherId = botId;
  const targetId = lastPlay.playerId;

  const cards = lastPlay.cards;
  const valid = !cards.some((c) => c !== requiredCard && c !== "JOKER");

  io.emit("revealCards", {
    playerId: targetId,
    cards
  });

  const shooter = valid ? catcherId : targetId;

  const shooterName =
    players.find((p) => p.id === shooter)?.name || "Người chơi";
  const catcherName =
    players.find((p) => p.id === catcherId)?.name || "Người chơi";
  const targetName =
    players.find((p) => p.id === targetId)?.name || "Người chơi";

  const summary = `${catcherName} bắt ${targetName}. ${shooterName} phải bắn!`;

  shooterIdLastRound = shooter;

  playerShootCount[shooter] = Math.min((playerShootCount[shooter] || 0) + 1, 6);
  const shootCount = playerShootCount[shooter];
  const chance = shootCount / 6;
  const isDead = Math.random() < chance;

  if (isDead) {
    players = players.map((p) =>
      p.id === shooter ? { ...p, alive: false } : p
    );
    io.emit("players", players);
    delete playerShootCount[shooter];
    io.emit("catchResult", {
      shooterId: shooter,
      result: "dead",
      message: `${summary}\n💥 ${shooterName} đã bị loại!`
    });
  } else {
    io.emit("catchResult", {
      shooterId: shooter,
      result: "survived",
      message: `${summary}\n😅 ${shooterName} may mắn sống sót!`
    });
  }

  io.emit("shootCountUpdate", {
    shooterId: shooter,
    shootCount: playerShootCount[shooter]
  });

  const next = getNextPlayerId(catcherId);
  currentPlayerId = next;

  io.emit("nextTurn", { currentPlayerId });

  lastPlay = null;

  const aliveCount = players.filter((p) => p.alive).length;

  if (aliveCount === 1) {
    const winner = players.find((p) => p.alive);
    io.emit("gameOver", { winner });
    players = [];
    deck = [];
    turnIndex = 0;
    hands = {}; // tay bài
    lastPlay = null; // lưu lượt gần nhất
    currentPlayerId = null;
    shooterIdLastRound = null;
    playerShootCount = {};
    gameStarted = false;
  } else {
    setTimeout(() => {
      resetRound();
      console.log("== PLAYERS ==");
      players.forEach((p) =>
        console.log(`${p.id} | ${p.name} | isBot: ${p.isBot}`)
      );

      console.log("== HANDS ==");
      Object.entries(hands).forEach(([id, cards]) => {
        console.log(`${id} => ${cards.join(", ")}`);
      });

      if (isBot(currentPlayerId)) {
        setTimeout(() => botPlayTurn(currentPlayerId), 2000);
      }
    }, 5000);
  }
}

function botPlayTurn(id) {
  if (currentPlayerId !== id || !isBot(id)) return;
  console.log(
    `[BOT] Đang xử lý lượt của ${id}, currentPlayerId = ${currentPlayerId}`
  );

  const botHand = hands[id];
  if (!botHand || botHand.length === 0) return;
  console.log(`Luot di cua bot ${id}`);
  botHand.forEach((c) => {
    console.log(`Bot ${id} played ${c}`);
  });
  // Nếu có thể bắt người, ưu tiên xử lý bắt
  if (lastPlay && lastPlay.playerId !== id) {
    const willCatch = Math.random() < 0.4; // 40% xác suất bắt người
    if (willCatch) {
      setTimeout(() => {
        handleCatchByBot(id);
      }, 1000);
      return; // ⛔ Không đánh bài trong lượt này nếu đã bắt
    }
  }

  // Bot logic: ưu tiên đánh đúng requiredCard
  const possible = botHand.filter((c) => c === requiredCard || c === "JOKER");
  let cardsToPlay = possible.slice(0, Math.min(3, possible.length));

  if (cardsToPlay.length === 0) {
    // Bluff: chọn ngẫu nhiên 1-3 lá
    const count = Math.min(3, botHand.length);
    cardsToPlay = botHand.slice(0, count);
  }

  // Gửi bài ra như người chơi thật
  lastPlay = { playerId: id, cards: cardsToPlay };

  // Xóa bài ra khỏi tay bot
  cardsToPlay.forEach((c) => {
    const idx = botHand.indexOf(c);
    if (idx !== -1) botHand.splice(idx, 1);
  });

  io.emit("played", {
    playerId: id,
    count: cardsToPlay.length,
    showCards: false,
    cards: []
  });

  io.to(id).emit("updateHand", [...hands[id]]);

  // Chuyển lượt tiếp theo
  currentPlayerId = getNextPlayerId(id);
  const onlyCatch = isOnlyPlayerWithCards(currentPlayerId);
  io.emit("nextTurn", {
    currentPlayerId,
    onlyCanCatch: onlyCatch
  });
  console.log("Da danh: ");
  cardsToPlay.forEach((c) => {
    console.log(`Bot ${id} played ${c}`);
  });
  console.log("Bai tren tay: ");
  botHand.forEach((c) => {
    console.log(`Bot ${id} played ${c}`);
  });
  console.log(`Ket thuc luoi cua bot ${id}`);
  // Gọi bot tiếp theo nếu có
  if (isBot(currentPlayerId)) {
    setTimeout(() => {
      botPlayTurn(currentPlayerId);
    }, 2000);
  }
}

io.on("connection", (socket) => {
  // console.log("Player connected:", socket.id);
  socket.on("join", (name) => {
    if (gameStarted) {
      socket.emit("joinRejected", "Ván đang diễn ra, không thể tham gia.");
      return;
    }
    if (players.length >= 4) {
      socket.emit("joinRejected", "Đã đủ 4 người chơi");
      return;
    }
    players.push({ id: socket.id, name, alive: true, isBot: false });

    //log players
    console.log("Players: [");
    players.forEach((p) => {
      console.log(p);
    });
    console.log("]");
    //=====================================

    io.emit("players", players);
  });

  socket.on("addBot", () => {
    addBot();
    //log players
    console.log("Players: [");
    players.forEach((p) => {
      console.log(p);
    });
    console.log("]");
    io.emit("players", players);
  });

  socket.on("startGame", () => {
    if (players.length < 2) {
      socket.emit("startError", "Cần ít nhất 2 người chơi để bắt đầu.");
      return;
    }
    io.emit("freeze", false);
    deck = shuffleDeck();
    hands = dealCards(deck); // Save hands globally

    players.forEach((p) => {
      playerShootCount[p.id] = 0;
    });

    // io.emit("start", {
    //   hands,
    //   requiredCard,
    //   currentPlayerId: players[turnIndex].id
    // });
    players.forEach((p) => {
      io.to(p.id).emit("start", {
        hand: hands[p.id],
        requiredCard,
        currentPlayerId: players[turnIndex].id
      });
    });

    gameStarted = true;

    console.log("== PLAYERS ==");
    players.forEach((p) =>
      console.log(`${p.id} | ${p.name} | isBot: ${p.isBot}`)
    );

    console.log("== HANDS ==");
    Object.entries(hands).forEach(([id, cards]) => {
      console.log(`${id} => ${cards.join(", ")}`);
    });
  });

  socket.on("playCards", ({ cards }) => {
    // Remove bài khỏi tay
    const playerHand = hands[socket.id];
    for (let c of cards) {
      const index = playerHand.indexOf(c);
      if (index !== -1) playerHand.splice(index, 1);
    }

    // Lưu lượt vừa chơi để kiểm tra nếu bị bắt
    lastPlay = { playerId: socket.id, cards };

    // Gửi dữ liệu ra bàn
    io.emit("played", {
      playerId: socket.id,
      count: cards.length,
      showCards: false,
      cards: []
    });

    // io.to(socket.id).emit("updateHand", hands[socket.id]);
    io.to(socket.id).emit("updateHand", [...hands[socket.id]]);

    // Cập nhật người chơi hiện tại
    currentPlayerId = getNextPlayerId(socket.id);
    io.emit("nextTurn", {
      currentPlayerId,
      onlyCanCatch: isOnlyPlayerWithCards(currentPlayerId)
    });

    if (isBot(currentPlayerId)) {
      setTimeout(() => botPlayTurn(currentPlayerId), 2000);
    }
  });

  socket.on("catchPlayer", () => {
    if (!lastPlay) return;

    io.emit("freeze", true);

    const catcherId = socket.id;
    const targetId = lastPlay.playerId;

    const cards = lastPlay.cards;
    const valid = !cards.some((c) => c !== requiredCard && c !== "JOKER");

    // Gửi hiển thị bài thật ra cho mọi người
    io.emit("revealCards", {
      playerId: targetId,
      cards
    });

    const shooter = valid ? catcherId : targetId;

    const shooterName =
      players.find((p) => p.id === shooter)?.name || "Người chơi";
    const catcherName =
      players.find((p) => p.id === catcherId)?.name || "Người chơi";
    const targetName =
      players.find((p) => p.id === targetId)?.name || "Người chơi";

    const summary = `${catcherName} bắt ${targetName}. ${shooterName} phải bắn!`;

    shooterIdLastRound = shooter; // lưu người vừa bắn

    playerShootCount[shooter] = Math.min(
      (playerShootCount[shooter] || 0) + 1,
      6
    );
    const shootCount = playerShootCount[shooter];
    const chance = shootCount / 6;
    const isDead = Math.random() < chance;

    if (isDead) {
      players = players.map((p) =>
        p.id === shooter ? { ...p, alive: false } : p
      );
      io.emit("players", players);
      delete playerShootCount[shooter];
      io.emit("catchResult", {
        shooterId: shooter,
        result: "dead",
        message: `${summary}\n💥 ${shooterName} đã bị loại!`
      });
    } else {
      io.emit("catchResult", {
        shooterId: shooter,
        result: "survived",
        message: `${summary}\n😅 ${shooterName} may mắn sống sót!`
      });
    }

    io.emit("shootCountUpdate", {
      shooterId: shooter,
      shootCount: playerShootCount[shooter]
    });

    const next = getNextPlayerId(catcherId);
    currentPlayerId = next;
    io.emit("nextTurn", { currentPlayerId });

    lastPlay = null;

    const aliveCount = players.filter((p) => p.alive).length;

    if (aliveCount === 1) {
      const winner = players.find((p) => p.alive);
      io.emit("gameOver", { winner });
      players = [];
      deck = [];
      turnIndex = 0;
      hands = {}; // tay bài
      lastPlay = null; // lưu lượt gần nhất
      currentPlayerId = null;
      shooterIdLastRound = null;
      playerShootCount = {};
      gameStarted = false;
    } else {
      setTimeout(() => {
        resetRound(); // ⬅️ Bắt đầu ván mới
        console.log("== PLAYERS ==");
        players.forEach((p) =>
          console.log(`${p.id} | ${p.name} | isBot: ${p.isBot}`)
        );

        console.log("== HANDS ==");
        Object.entries(hands).forEach(([id, cards]) => {
          console.log(`${id} => ${cards.join(", ")}`);
        });
      }, 5000);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);

    // Xóa player
    players = players.filter((p) => p.id !== socket.id);

    // Xóa tay bài
    delete hands[socket.id];

    // Xóa số lần bắn
    delete playerShootCount[socket.id];

    // Nếu người đó đang giữ lượt, thì chuyển lượt
    if (currentPlayerId === socket.id) {
      currentPlayerId = getNextPlayerId(socket.id);
      io.emit("nextTurn", { currentPlayerId });
    }

    // Nếu họ là người vừa chơi gần nhất
    if (lastPlay?.playerId === socket.id) {
      lastPlay = null;
    }
    let hetNguoiChoi = true;
    if (players.length !== 0) {
      players.forEach((p) => {
        if (!p.isBot) {
          hetNguoiChoi = false;
        }
      });
    }

    if (hetNguoiChoi) {
      players = [];
      deck = [];
      turnIndex = 0;
      hands = {}; // tay bài
      lastPlay = null; // lưu lượt gần nhất
      currentPlayerId = null;
      shooterIdLastRound = null;
      playerShootCount = {};
      gameStarted = false;
    }

    // Cập nhật danh sách người chơi
    io.emit("players", players);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
