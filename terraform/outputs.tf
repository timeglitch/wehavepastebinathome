output "public_ip" {
  description = "Public IP of the pastebin server"
  value       = aws_eip.pastebin.public_ip
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ec2-user@${aws_eip.pastebin.public_ip}"
}

output "url" {
  description = "URL of the pastebin"
  value       = "http://${aws_eip.pastebin.public_ip}"
}
