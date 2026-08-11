FROM node:20-bookworm-slim

# Cài đặt ffmpeg, python3 và pip cho RVC Voice Conversion
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt PyTorch CPU & rvc-python cho mô hình RVC Độ Mixi
RUN pip3 install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu --break-system-packages || true
RUN pip3 install --no-cache-dir rvc-python soundfile librosa numpy --break-system-packages || true

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
