# Gunakan image resmi Playwright yang sudah lengkap dengan library Linux
FROM mcr.microsoft.com/playwright:v1.40.1-focal

# Set working directory
WORKDIR /app

# Copy package files dan install dependencies
COPY package*.json ./
RUN npm install

# Copy seluruh kode aplikasi
COPY . .

# Expose port (Railway akan menggunakan port dinamis)
EXPOSE 3000

# Jalankan aplikasi
CMD ["node", "server.js"]
