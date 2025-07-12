import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { ToastContainer, toast } from "react-toastify";

const socket = io(import.meta.env.VITE_SOCKET_URL);

function App() {
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState([]);
  const [hand, setHand] = useState([]);
  const [requiredCard, setRequiredCard] = useState("");
  const [myTurn, setMyTurn] = useState(false);
  const [playedCards, setPlayedCards] = useState([]);
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [lastPlayedByOther, setLastPlayedByOther] = useState(false);
  const [currentPlayer, setCurrentPlayerId] = useState("");
  const [playerShootMap, setPlayerShootMap] = useState({});
  const [gameStarted, setGameStarted] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [onlyCanCatch, setOnlyCanCatch] = useState(false);
  const [isFreezed, setFrozen] = useState(false);

  useEffect(() => {
    socket.on("freeze", (isFreezed) => setFrozen(isFreezed));
    socket.on("players", (players) => {
      setPlayers(players);
      setIsHost(players[0]?.id === socket.id);
    });
    socket.on("joinRejected", (msg) => {
      setJoinError(msg);
      // alert(msg);
      toast.error(msg);
      window.location.reload();
    });
    socket.on("startError", (msg) => {
      // alert(msg);
      toast.error(msg);
    });
    socket.on("start", ({ hand, requiredCard, currentPlayerId }) => {
      setHand([...hand]); // 👈 clone để tránh bị mutate ngoài ý muốn
      setRequiredCard(requiredCard);
      setMyTurn(currentPlayerId === socket.id);
      setPlayedCards([]);
    });

    socket.on("nextTurn", ({ currentPlayerId, onlyCanCatch }) => {
      setMyTurn(currentPlayerId === socket.id);
      setCurrentPlayerId(currentPlayerId);
      setOnlyCanCatch(onlyCanCatch);
    });
    socket.on("played", ({ playerId, count, showCards, cards }) => {
      setPlayedCards((prev) => [
        {
          playerId,
          cards: showCards ? cards : Array(count).fill("❓"),
          revealed: showCards
        }
      ]);
      setLastPlayedByOther(playerId !== socket.id);
    });
    socket.on("revealCards", ({ playerId, cards }) => {
      setPlayedCards((prev) =>
        prev.map((p) =>
          p.playerId === playerId ? { ...p, cards, revealed: true } : p
        )
      );
    });
    socket.on("startNewRound", ({ requiredCard, currentPlayerId }) => {
      setGameStarted(true);
      setRequiredCard(requiredCard);
      setMyTurn(currentPlayerId === socket.id);
      setPlayedCards([]);
      setSelectedIndexes([]);
      setCurrentPlayerId(currentPlayerId);
      setLastPlayedByOther(false);
    });
    socket.on("clearPlayedCards", () => {
      setPlayedCards([]);
    });
    socket.on("shootCountUpdate", ({ shooterId, shootCount }) => {
      setPlayerShootMap((prev) => ({
        ...prev,
        [shooterId]: shootCount
      }));
    });
    socket.on("catchResult", ({ shooterId, result, message }) => {
      // alert(message);
      toast(message);
    });
    socket.on("updateHand", (newHand) => {
      setHand(newHand);
    });
    socket.on("gameOver", ({ winner }) => {
      // alert(`🎉 ${winner.name} là người chiến thắng cuối cùng!`);
      toast.success(`🎉 ${winner.name} là người chiến thắng cuối cùng!`);
      setTimeout(() => {
        socket.emit("disconnect");
        window.location.reload();
      }, 3000);
    });

    return () => {
      socket.off("players");
      socket.off("joinRejected");
      socket.off("startError");
      socket.off("start");
      socket.off("nextTurn");
      socket.off("played");
      socket.off("revealCards");
      socket.off("startNewRound");
      socket.off("clearPlayedCards");
      socket.off("shootCountUpdate");
      socket.off("catchResult");
      socket.off("updateHand");
      socket.off("gameOver");
    };
  }, []);

  // Hàm ánh xạ lá bài sang tên file hình ảnh
  const getCardImage = (card) => {
    if (card === "❓") return "/assets/cards/back.png"; // Hình ảnh mặt sau cho bài ẩn
    const value = card; // Lấy giá trị (A, 2, 3, ..., K)
    // const value = card.slice(0, -1); // Lấy giá trị (A, 2, 3, ..., K)
    // const suitMap = {
    //   "♠": "S",
    //   "♥": "H",
    //   "♦": "D",
    //   "♣": "C"
    // };
    // const suit = card.slice(-1); // Lấy chất (♠, ♥, ♦, ♣)
    // return `/cards/${value}${suitMap[suit]}.png`;
    return `/assets/cards/${value}.png`;
  };

  const joinGame = () => {
    if (name.trim()) {
      socket.emit("join", name);
      setJoined(true);
    }
  };

  const toggleCard = (index) => {
    if (selectedIndexes.includes(index)) {
      setSelectedIndexes(selectedIndexes.filter((i) => i !== index));
    } else {
      if (selectedIndexes.length < 3) {
        setSelectedIndexes([...selectedIndexes, index]);
      }
    }
  };

  const playCards = () => {
    const selectedCards = selectedIndexes.map((i) => hand[i]);
    socket.emit("playCards", { cards: selectedCards });
    setSelectedIndexes([]);
  };
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <ToastContainer />
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-7xl h-[90vh] overflow-auto p-6 md:p-8">
        {!joined ? (
          <div className="flex flex-col items-center justify-center h-full space-y-8">
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800 tracking-tight">
              🎴 Tham Gia Trò Chơi
            </h1>
            <div className="flex w-full max-w-lg gap-4">
              <input
                className="flex-1 border-2 border-gray-200 rounded-xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-lg placeholder-gray-400"
                placeholder="Nhập tên của bạn"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button
                onClick={joinGame}
                className="bg-blue-500 text-white px-8 py-3 rounded-xl hover:bg-blue-600 transition font-medium text-lg shadow-md"
              >
                Tham gia
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 h-full">
            {/* Left Column: Main game content */}
            <div className="flex-1 space-y-6">
              {joinError && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-base font-medium shadow-sm">
                  ⚠️ {joinError}
                </div>
              )}

              {!gameStarted && isHost && (
                <div className="flex justify-center">
                  {players.length <= 4 ? (
                    <div className="flex gap-4 justify-center">
                      <button
                        onClick={() => {
                          socket.emit("startGame");
                          setGameStarted(true);
                        }}
                        className="bg-blue-500 text-white px-8 py-4 rounded-xl hover:bg-blue-600 transition font-medium text-lg shadow-md flex items-center gap-3"
                      >
                        🎮 Bắt đầu chơi
                      </button>

                      <button
                        onClick={() => socket.emit("addBot")}
                        className="bg-green-500 text-white px-6 py-4 rounded-xl hover:bg-green-600 transition font-medium text-lg shadow-md"
                      >
                        🤖 Thêm AI
                      </button>
                    </div>
                  ) : (
                    <p className="text-red-500 font-medium text-lg">
                      Đã đủ 4 người chơi.
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-800">
                  Người chơi: <span className="text-blue-600">{name}</span>
                </h2>
                <h3 className="text-xl md:text-2xl font-medium text-gray-700">
                  Bài yêu cầu:{" "}
                  <span className="font-bold text-purple-600">
                    {requiredCard}
                  </span>
                </h3>
              </div>

              <div>
                <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mb-4">
                  Bài trên tay
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {hand.map((card, i) => (
                    <button
                      key={i}
                      onClick={() => toggleCard(i)}
                      className={`relative px-4 py-3 rounded-xl shadow-md transition-transform transform hover:scale-105 text-lg font-medium ${
                        selectedIndexes.includes(i)
                          ? "bg-yellow-100 border-2 border-yellow-400 shadow-lg"
                          : "bg-white border border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <img
                        src={getCardImage(card)}
                        alt={card}
                        className="w-20 h-30 md:w-24 md:h-32 object-cover"
                      />
                      {selectedIndexes.includes(i) && (
                        <span className="absolute -top-2 -right-2 bg-yellow-400 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          ✓
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {myTurn ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    disabled={
                      selectedIndexes.length === 0 ||
                      selectedIndexes.length > 3 ||
                      onlyCanCatch
                    }
                    className={`flex-1 px-6 py-4 rounded-xl font-medium text-lg transition shadow-md ${
                      selectedIndexes.length === 0 ||
                      selectedIndexes.length > 3 ||
                      onlyCanCatch
                        ? "bg-gray-200 cursor-not-allowed text-gray-500"
                        : "bg-green-500 text-white hover:bg-green-600"
                    }`}
                    onClick={playCards}
                  >
                    Ra bài{" "}
                    {selectedIndexes.length > 0
                      ? `(${selectedIndexes.length})`
                      : ""}
                  </button>
                  {myTurn && lastPlayedByOther && (
                    <button
                      className="px-6 py-4 bg-red-500 text-white rounded-xl hover:bg-red-600 transition font-medium text-lg shadow-md"
                      onClick={() => socket.emit("catchPlayer")}
                    >
                      Bắt người trước
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-gray-600 font-medium text-lg animate-pulse">
                  Đang chờ đối thủ...
                </p>
              )}

              {selectedIndexes.length > 3 && (
                <p className="text-red-500 text-base font-medium bg-red-50 p-3 rounded-xl">
                  Chỉ được chọn tối đa 3 lá
                </p>
              )}

              {onlyCanCatch && (
                <div className="bg-yellow-50 text-yellow-700 p-4 rounded-xl text-base font-medium shadow-sm">
                  🔒 Bạn chỉ được quyền bắt người chơi trước vì chỉ còn bạn còn
                  bài!
                </div>
              )}

              <div>
                <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mb-4">
                  Danh sách người chơi
                </h3>
                <ul className="space-y-3">
                  {players.map((p) => {
                    const isYou = p.id === socket.id;
                    const isDead = !p.alive;
                    const isCurrentTurn = p.id === currentPlayer;
                    const shoot = playerShootMap[p.id] || 0;

                    return (
                      <li
                        key={p.id}
                        className={`flex items-center gap-3 p-4 rounded-xl text-lg transition-all ${
                          isDead
                            ? "bg-red-50 text-red-400 line-through"
                            : "bg-gray-50 hover:bg-gray-100"
                        } ${
                          isCurrentTurn && !isDead
                            ? "border-2 border-blue-400 shadow-md"
                            : ""
                        }`}
                      >
                        {players[0].id === p.id && (
                          <span className="text-yellow-500">👑</span>
                        )}
                        <span className="font-medium">{p.name}</span>
                        {isYou && (
                          <span className="text-gray-500 text-sm">(Bạn)</span>
                        )}
                        {isCurrentTurn && !isDead && (
                          <span className="text-blue-600 font-medium">
                            🎯 Đang chơi
                          </span>
                        )}
                        {!isDead && (
                          <span className="text-gray-600">
                            🔫 Bắn: {shoot}/6
                          </span>
                        )}
                        {isDead && <span>💀</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Right Column: Played Cards */}
            <div className="w-full md:w-1/3 bg-gray-100 p-6 rounded-xl shadow-lg h-fit md:h-full overflow-auto">
              <h4 className="text-2xl md:text-3xl font-bold text-gray-800 mb-6">
                {(playedCards.length > 0 &&
                  players.find((p) => p.id === playedCards[0].playerId)
                    ?.name) ||
                  "Người chơi"}{" "}
                vừa ra bài:
              </h4>
              <div className="space-y-4">
                {playedCards.length > 0 && (
                  <div className="bg-white p-6 shadow-md flex items-center justify-center gap-4 border-2 border-blue-300 scale-105 transition-transform">
                    <div className="flex flex-wrap gap-6">
                      {playedCards[0].cards.map((card, index) => (
                        <img
                          key={index}
                          src={getCardImage(card)}
                          alt={card}
                          className="w-20 h-30 md:w-32 md:h-48 object-cover shadow-md hover:scale-110 transition-transform"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {isFreezed && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-30 backdrop-blur-sm cursor-not-allowed flex items-center justify-center">
          {playedCards.length > 0 && (
            <div className="bg-white p-6 shadow-md flex items-center justify-center gap-4 border-2 border-blue-300 scale-105 transition-transform">
              <div className="flex flex-wrap gap-6">
                {playedCards[0].cards.map((card, index) => {
                  const actualCard =
                    playedCards[0].revealed || isFreezed ? card : "❓";

                  return (
                    <img
                      key={index}
                      src={getCardImage(actualCard)}
                      alt={actualCard}
                      className="w-24 h-32 md:w-32 md:h-48 object-cover shadow-md hover:scale-110 transition-transform"
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
