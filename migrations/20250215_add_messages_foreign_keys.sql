-- Ajout des clés étrangères pour la table messages
ALTER TABLE messages
ADD CONSTRAINT fk_messages_sender
FOREIGN KEY (sender_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

ALTER TABLE messages
ADD CONSTRAINT fk_messages_receiver
FOREIGN KEY (receiver_id)
REFERENCES profiles(id)
ON DELETE CASCADE;

ALTER TABLE messages
ADD CONSTRAINT fk_messages_property
FOREIGN KEY (property_id)
REFERENCES properties(id)
ON DELETE CASCADE;
