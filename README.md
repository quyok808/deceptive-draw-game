# DECEPTIVE DRAW GAME

## Giới thiệu

Deceptive game draw là dự án game thẻ bài chiến thuật viết bằng Javascript. Trong game này, mục tiêu là phải tìm ra người đang ra bài không đúng với bài được chỉ định từ ban đầu, nếu người bị bắt ra bài sai so với bài đã chỉ định thì sẽ phải chịu hình phạt. Mỗi vòng chơi người chơi sẽ có tỉ lệ bị loại là 16% và tăng dần theo vòng. 

## Tính năng

- Chia bài và chỉ định bài mà người chơi cần phải đánh.
- Bắt người ra bài trong lượt vừa rồi.
- Thêm Bot vào màn chơi

## Cấu trúc dự án

    deceptive-draw-game/
    ├── deceptive-draw-client/       # Front-end ReactJs
    ├── deceptive-draw-server/       # Backend Nodejs + Socket.io
    └── README.md

## Yêu cầu hệ thống

- Node.js v20.X.X
- npm

## Cài đặt

1. Clone repository:
    ```bash
   git clone https://github.com/quyok808/deceptive-draw-game
   ```

2. Cài đặt dependencies:
- FE:

    ``` bash
   cd deceptive-draw-client
   
   npm install
   ```
- BE: 

    ```bash
    cd deceptive-draw-server
   
    npm install
    ```

3. Chạy ứng dụng:
- BE: 

    ```bash
    npm start

    ```
- FE: 

    ```bash
    npm run dev

    ```

## Cấu hình

- FE .env: 
    ```bash
    VITE_SOCKET_URL=http://localhost:3001
    ```

## Sử dụng

1. Mở trình duyệt tại http://localhost:5173
2. Nhập tên
3. Thêm BOT hoặc đợi người chơi khác join

## Công nghệ sử dụng

- Frontend: ReactJs
- Backend: NodeJS + Socket.io

## Bản quyền

© 2025 - Nguyễn Công Quý.
