FROM node:20-bookworm-slim

# Cài đặt ffmpeg và các công cụ build cần thiết cho Opus/Audio
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package.json và cài đặt dependencies
COPY package*.json ./
RUN npm install --omit=dev


# Copy toàn bộ mã nguồn vào container
COPY . .

# Tạo thư mục chứa audio tạm nếu chưa có
RUN mkdir -p audio_cache

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
