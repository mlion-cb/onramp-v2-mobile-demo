import { getCurrentPartnerUserRef } from "@/utils/sharedState";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { CoinbaseAlert } from "../components/ui/CoinbaseAlerts";
import { COLORS } from "../constants/Colors";
import { fetchTransactionHistory } from "../utils/fetchTransactionHistory";


const { BLUE, DARK_BG, CARD_BG, BORDER, TEXT_PRIMARY, TEXT_SECONDARY, WHITE } = COLORS;

type Transaction = {
  transaction_id: string;  
  status: string;
  payment_total: {        
    value: string;
    currency: string;
  };
  purchase_currency: string;  
  purchase_network: string;   
  created_at: string;         
  partner_user_ref: string;   
  wallet_address: string;     
  tx_hash: string;           
};

export default function History() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUserRef, setCurrentUserRef] = useState<string | null>(null);
  const [nextPageKey, setNextPageKey] = useState<string | null>(null); // Add this
  const [currentPage, setCurrentPage] = useState(1); // Add this

  const [alertState, setAlertState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info'
  });

  useFocusEffect(
    useCallback(() => {
      const userRef = getCurrentPartnerUserRef();
      console.log('History tab focused, updating userRef to:', userRef);
      setCurrentUserRef(userRef);
    }, [])
  );

  useEffect(() => {
    const userRef = getCurrentPartnerUserRef();
    setCurrentUserRef(userRef);
  }, []);

  const loadTransactions = useCallback(async (pageKey?: string, isNewPage: boolean = false) => {
    const userRef = getCurrentPartnerUserRef();
    if (!userRef) {
      setAlertState({
        visible: true,
        title: "No User Reference",
        message: "Complete an onramp transaction first to see history",
        type: 'info'
      });
      return;
    }

    try {
      setLoading(true);
      const result = await fetchTransactionHistory(userRef, pageKey, 10);
      setTransactions(result.transactions || []); // Replace for new page
      setNextPageKey(result.nextPageKey || null);

    } catch (error) {
      console.error("Failed to load transaction history:", error);
      setAlertState({
        visible: true,
        title: "Error",
        message: "Failed to load transaction history",
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    loadTransactions(); // Call without parameters for refresh
  }, [loadTransactions]);

  // Load next page
  const loadNextPage = useCallback(() => {
    if (nextPageKey && !loading) {
      setCurrentPage(prev => prev + 1);
      loadTransactions(nextPageKey, true);
    }
  }, [nextPageKey, loading, loadTransactions]);

  // Load previous page (you'd need to track page keys for this)
  const loadPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      // For previous page, you'd need to store previous pageKeys
      // For simplicity, let's just reload from start
      loadTransactions(undefined, true);
    }
  }, [currentPage, loadTransactions]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "success":
        return "#00D632";
      case "pending":
      case "processing":
        return "#FF8500";
      case "failed":
      case "error":
        return "#D32F2F";
      default:
        return TEXT_SECONDARY;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <Text style={styles.transactionAmount}>
          {item.payment_total.value} {item.payment_total.currency}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.replace('ONRAMP_TRANSACTION_STATUS_', '')}</Text>
        </View>
      </View>
      <Text style={styles.transactionDetails}>
        {item.purchase_currency} on {item.purchase_network}
      </Text>
      <Text style={styles.transactionDate}>{formatDate(item.created_at)}</Text>
      <Text style={styles.transactionId}>ID: {item.transaction_id}</Text>
      {item.tx_hash && (
        <Text style={styles.transactionHash}>Hash: {item.tx_hash}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaction History</Text>
        <Pressable
          onPress={handleRefresh}
          disabled={loading}
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && { opacity: 0.7 },
            loading && { opacity: 0.5 },
          ]}
        >
          {loading ? (
            <ActivityIndicator size="small" color={BLUE} />
          ) : (
            <Ionicons name="refresh" size={20} color={BLUE} />
          )}
        </Pressable>
      </View>

      <View style={styles.userRefSection}>
        <Text style={styles.userRefLabel}>Current User Reference:</Text>
        <Text style={styles.userRefValue}>
          {currentUserRef || "None (complete a transaction first)"}
        </Text>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={64} color={TEXT_SECONDARY} />
          <Text style={styles.emptyTitle}>No Transactions Yet</Text>
          <Text style={styles.emptyMessage}>
            {currentUserRef
              ? "Complete your first onramp transaction to see it here"
              : "Connect a wallet and complete a transaction to see history"}
          </Text>
        </View>
      ) : (
          <FlatList
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.transaction_id} 
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
          <CoinbaseAlert
            visible={alertState.visible}
            title={alertState.title}
            message={alertState.message}
            type={alertState.type}
            onConfirm={() => setAlertState(prev => ({ ...prev, visible: false }))}
          />
          <View style={styles.paginationContainer}>
            <Pressable
              style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
              onPress={loadPreviousPage}
              disabled={currentPage === 1 || loading}
            >
              <Text style={[styles.paginationText, currentPage === 1 && styles.paginationTextDisabled]}>
                Previous
              </Text>
            </Pressable>
            
            <Text style={styles.pageNumber}>Page {currentPage}</Text>
            
            <Pressable
              style={[styles.paginationButton, !nextPageKey && styles.paginationButtonDisabled]}
              onPress={loadNextPage}
              disabled={!nextPageKey || loading}
            >
              <Text style={[styles.paginationText, !nextPageKey && styles.paginationTextDisabled]}>
                Next
              </Text>
            </Pressable>
          </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,    
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: CARD_BG,    
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  refreshButton: {
    padding: 8,
  },
  userRefSection: {
    backgroundColor: CARD_BG,
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  userRefLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  userRefValue: {
    fontSize: 12,
    fontFamily: "monospace",
    color: TEXT_PRIMARY,
    backgroundColor: DARK_BG,
    padding: 8,
    borderRadius: 6,
  },
  listContainer: {
    padding: 20,
  },
  transactionCard: {
    backgroundColor: CARD_BG, 
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  transactionAmount: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_PRIMARY,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#FFFFFF",
    textTransform: "capitalize",
  },
  transactionDetails: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  transactionId: {
    fontSize: 10,
    fontFamily: "monospace",
    color: TEXT_SECONDARY,
  },
  transactionHash: {
    fontSize: 10,
    fontFamily: "monospace",
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: TEXT_PRIMARY,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: "center",
    lineHeight: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  paginationButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: BLUE,
    borderRadius: 8,
    minWidth: 80,
  },
  paginationButtonDisabled: {
    backgroundColor: BORDER,
    opacity: 0.5,
  },
  paginationText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  paginationTextDisabled: {
    color: TEXT_SECONDARY,
  },
  pageNumber: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '500',
  },
});