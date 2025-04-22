// Envoyer un message
const sendMessage = async () => {
  if (!newMessage.trim() || sending) return;

  try {
    setSending(true);
    
    console.log('[ChatScreen] Tentative d\'envoi du message:', newMessage);
    
    // Informer que nous envoyons un nouveau message
    eventEmitter.emit('newMessage', {
      propertyId: property?.id,
      senderId: currentUser?.id,
      receiverId: receiverId
    });
    
    // Vérifier si l'utilisateur est authentifié
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.error('[ChatScreen] Utilisateur non authentifié');
      Alert.alert('Erreur', 'Vous devez être connecté pour envoyer un message.');
      setSending(false);
      return;
    }
    
    // Préparer les données du message
    const messageData = {
      content: newMessage,
      sender_id: currentUser?.id,
      receiver_id: receiverId,
      property_id: property?.id,
      created_at: new Date().toISOString()
    };
    
    console.log('[ChatScreen] Envoi du message avec les données:', messageData);
    
    // Essayer d'abord d'utiliser la fonction RPC si elle existe
    let result;
    try {
      // Appeler une fonction RPC pour insérer le message avec les bonnes permissions
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('insert_message', messageData);

      if (!rpcError) {
        result = { data: [rpcData], error: null };
        console.log('[ChatScreen] Message envoyé via RPC avec succès');
      } else {
        console.log('[ChatScreen] Erreur RPC, fallback à l\'insertion directe:', rpcError);
        // Si la fonction RPC n'existe pas ou échoue, essayer l'insertion directe
        const { data, error } = await supabase
          .from('messages')
          .insert([messageData])
          .select();
          
        result = { data, error };
      }
    } catch (error) {
      console.error('[ChatScreen] Erreur lors de l\'envoi du message via RPC:', error);
      // Fallback à l'insertion directe
      const { data, error: insertError } = await supabase
        .from('messages')
        .insert([messageData])
        .select();
        
      result = { data, error: insertError };
    }
    
    // Vérifier s'il y a eu une erreur
    if (result && result.error) {
      throw result.error;
    }
    
    // Message envoyé avec succès, créer la notification pour le destinataire
    try {
      await notificationService.createNotification({
        id: Date.now().toString(),
        type: 'new_message',
        title: 'Nouveau message',
        message: `Vous avez reçu un nouveau message de ${currentUser?.full_name || 'un utilisateur'}`,
        timestamp: new Date().toISOString(),
        read: false,
        data: {
          sender_id: currentUser?.id,
          receiver_id: receiverId,
          property_id: property?.id,
          message_id: result?.data?.[0]?.id || Date.now().toString(),
          property_name: property?.title || 'Propriété'
        },
        user_id: receiverId
      });
    } catch (notifError) {
      console.error('[ChatScreen] Erreur lors de la création de la notification:', notifError);
      // Continuer même si la notification échoue
    }
    
    // Mettre à jour l'interface utilisateur
    setNewMessage('');
    
    // Informer les autres composants qu'un message a été envoyé
    eventEmitter.emit('messageSent', {
      message: result?.data?.[0] || { id: Date.now().toString(), content: newMessage },
      propertyId: property?.id,
      senderId: currentUser?.id,
      receiverId: receiverId
    });
    
    // Forcer le rafraîchissement des conversations dans MessagesScreen
    eventEmitter.emit('conversationsRefresh');
    
    // Rafraîchir les messages pour voir le nouveau message
    loadMessages();
  } catch (error) {
    console.error('[ChatScreen] Erreur lors de l\'envoi du message:', error);
    Alert.alert('Erreur', 'Impossible d\'envoyer le message. Veuillez réessayer.');
  } finally {
    setSending(false);
  }
};
