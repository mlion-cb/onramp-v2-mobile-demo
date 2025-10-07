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
import { CoinbaseAlert } from "../../components/ui/CoinbaseAlerts";
import { COLORS } from "../../constants/Colors";
import { fetchTransactionHistory } from "../../utils/fetchTransactionHistory";


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
  // const [nextPageKey, setNextPageKey] = useState<string | null>(null); // Add this
  // const [currentPage, setCurrentPage] = useState(1); // Add this

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
      const result = await fetchTransactionHistory(userRef, pageKey, 50);
      setTransactions(result.transactions || []); // Replace for new page
      // setNextPageKey(result.nextPageKey || null);

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

  useFocusEffect(
    useCallback(() => {
      const userRef = getCurrentPartnerUserRef();
      console.log('History tab focused, updating userRef to:', userRef);
      setCurrentUserRef(userRef);

      // Auto-load transactions when tab becomes active
      if (userRef) {
        loadTransactions();
      }
    }, [loadTransactions])
  );

  useEffect(() => {
    const userRef = getCurrentPartnerUserRef();
    setCurrentUserRef(userRef);

    // Load transactions when userRef is available
    if (userRef) {
      loadTransactions();
    }
  }, [loadTransactions]);

  
  const handleRefresh = useCallback(() => {
    loadTransactions(); // Call without parameters for refresh
  }, [loadTransactions]);

  // // Load next page
  // const loadNextPage = useCallback(() => {
  //   if (nextPageKey && !loading) {
  //     setCurrentPage(prev => prev + 1);
  //     loadTransactions(nextPageKey, true);
  //   }
  // }, [nextPageKey, loading, loadTransactions]);

  // // Load previous page (you'd need to track page keys for this)
  // const loadPreviousPage = useCallback(() => {
  //   if (currentPage > 1) {
  //     setCurrentPage(prev => prev - 1);
  //     // For previous page, you'd need to store previous pageKeys
  //     // For simplicity, let's just reload from start
  //     loadTransactions(undefined, true);
  //   }
  // }, [currentPage, loadTransactions]);

  const getStatusColor = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus.includes("completed") || normalizedStatus.includes("success")) {
      return "#00D632"; // Green
    }
    if (normalizedStatus.includes("pending") || normalizedStatus.includes("processing")) {
      return "#FF8500"; // Orange
    }
    if (normalizedStatus.includes("failed") || normalizedStatus.includes("error")) {
      return "#FF6B6B"; // Red
    }
    return TEXT_SECONDARY; // Default gray
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
    <View style={styles.transactionItem}>
      <View style={styles.transactionIcon}>
        <Ionicons 
          name="swap-horizontal"
          size={16} 
          color={WHITE}
        />
      </View>
      <View style={styles.transactionContent}>
        {/* First row: Title and Amount */}
        <View style={styles.transactionRow}>
          <Text style={styles.transactionTitle}>
            {item.purchase_currency} Purchase
          </Text>
          <Text style={styles.transactionAmount}>
            ${item.payment_total.value}
          </Text>
        </View>
        
        {/* Second row: Network/Date and Status */}
        <View style={styles.transactionRow}>
          <Text style={styles.transactionSubtitle}>
            {item.purchase_network} • {formatDate(item.created_at)}
          </Text>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.replace(/ONRAMP_TRANSACTION_STATUS_/g, '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Transaction History (Apple Pay only)</Text>
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
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
          <CoinbaseAlert
            visible={alertState.visible}
            title={alertState.title}
            message={alertState.message}
            type={alertState.type}
            onConfirm={() => setAlertState(prev => ({ ...prev, visible: false }))}
          />
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
    // secondary button style
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,                 
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    
    // Subtle shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CARD_BG, // Neutral background
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY, // Neutral white text
    textAlign: 'right',
  },
  transactionContent: {
    flex: 1,
    gap: 6, // Space between the two rows
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1, // Take up available space
  },
  transactionSubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    flex: 1, // Take up available space
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
    paddingLeft: 8, // Small padding to separate from subtitle
  },
  separator: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 68,
  },
  transactionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
  paginationButton: {
    backgroundColor: BLUE,            
    paddingHorizontal: 20,            
    paddingVertical: 12,
    borderRadius: 20,               
    minWidth: 80,
    alignItems: 'center',
    
    // Coinbase shadow
    shadowColor: BLUE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  paginationButtonDisabled: {
    backgroundColor: BORDER,           // Gray when disabled
    shadowOpacity: 0,                 // No shadow when disabled
    elevation: 0,
  },
  paginationText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',                // Semibold
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
  pageIndicator: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '500',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionMeta: {
    alignItems: "flex-end",
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: DARK_BG,
    gap: 16,
  },
  paginationArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  paginationArrowDisabled: {
    opacity: 0.3,
  },
  pageNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentPageNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentPageText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  pageNumbersText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
});