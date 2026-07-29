$sshKey = "C:\Users\Millan\Downloads\stockubu.pem"
$userHost = "ubuntu@ec2-54-165-116-67.compute-1.amazonaws.com"

$remoteCommand = @"
cd /var/www/stockoracle 2>/dev/null || cd ~/stockoracle-pro 2>/dev/null
echo "Pulling latest code..."
sudo git reset --hard
sudo git pull

echo "Updating frontend..."
cd frontend
sudo npm install
sudo npm run build

echo "Updating backend..."
cd ../
sudo pip install -r backend/requirements.txt || sudo pip3 install -r backend/requirements.txt

echo "Restarting services..."
sudo pm2 restart all || sudo systemctl restart stockoracle || echo "Please restart your server manually if pm2/systemctl failed"
"@

ssh -o StrictHostKeyChecking=no -i $sshKey $userHost $remoteCommand
