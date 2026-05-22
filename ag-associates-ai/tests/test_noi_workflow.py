"""End-to-end tests for NOI workflow."""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Import the modules we need to test
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from noi_agent import noi_agent, NOI_STATES


class TestNOIWorkflow:
    """Test the complete NOI workflow."""

    @pytest.fixture
    def mock_case_data(self):
        """Mock case data for testing."""
        return {
            "id": "test-case-123",
            "loan_amount": "5000000",
            "bank_name": "ICICI Bank",
            "borrower_name": "John Doe",
            "property_address": "123 Main Street",
            "property_city": "Mumbai",
            "noi_status": "DOCUMENTS_RECEIVED"
        }

    @pytest.mark.asyncio
    async def test_get_case_success(self, mock_case_data):
        """Test successful case retrieval."""
        with patch('noi_agent.httpx.AsyncClient') as mock_client:
            mock_response = AsyncMock()
            mock_response.json.return_value = [mock_case_data]
            mock_response.raise_for_status = AsyncMock()
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            result = await noi_agent.get_case("test-case-123")
            assert result == mock_case_data

    @pytest.mark.asyncio
    async def test_get_case_not_found(self):
        """Test case not found."""
        with patch('noi_agent.httpx.AsyncClient') as mock_client:
            mock_response = AsyncMock()
            mock_response.json.return_value = []
            mock_response.raise_for_status = AsyncMock()
            
            mock_client_instance = AsyncMock()
            mock_client_instance.get.return_value = mock_response
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            result = await noi_agent.get_case("non-existent")
            assert result is None

    @pytest.mark.asyncio
    async def test_update_noi_status_success(self):
        """Test successful status update."""
        with patch('noi_agent.httpx.AsyncClient') as mock_client:
            mock_response = AsyncMock()
            mock_response.raise_for_status = AsyncMock()
            
            mock_client_instance = AsyncMock()
            mock_client_instance.patch.return_value = mock_response
            mock_client.return_value.__aenter__.return_value = mock_client_instance
            
            with patch('noi_agent.noi_agent._log_timeline') as mock_log:
                with patch('noi_agent.record_activity'):
                    result = await noi_agent.update_noi_status(
                        "test-case-123", 
                        "CHALLAN_GENERATED", 
                        "Test notes"
                    )
                    assert result is True

    @pytest.mark.asyncio
    async def test_update_noi_status_no_config(self):
        """Test status update when Supabase not configured."""
        with patch('noi_agent.os.environ.get', side_effect=lambda k, d: ""):
            result = await noi_agent.update_noi_status(
                "test-case-123", 
                "CHALLAN_GENERATED"
            )
            assert result is False

    @pytest.mark.asyncio
    async def test_generate_challan_success(self, mock_case_data):
        """Test successful challan generation."""
        with patch('noi_agent.noi_agent.get_case') as mock_get_case:
            mock_get_case.return_value = mock_case_data
            
            with patch('noi_agent.noi_agent.update_noi_status') as mock_update:
                with patch('noi_agent.noi_agent._notify'):
                    with patch('noi_agent.executor_agent') as mock_executor:
                        mock_executor.generate_noi_challan = AsyncMock(
                            return_value={
                                "success": True,
                                "grn_number": "GRN123456",
                                "amount_paid": "15000"
                            }
                        )
                        
                        result = await noi_agent.generate_challan("test-case-123")
                        
                        assert result["success"] is True
                        assert result["grn_number"] == "GRN123456"
                        mock_update.assert_called_once_with(
                            "test-case-123", 
                            "CHALLAN_GENERATED",
                            notes="GRN: GRN123456, Amount: ₹15000"
                        )

    @pytest.mark.asyncio
    async def test_generate_challan_case_not_found(self):
        """Test challan generation when case not found."""
        with patch('noi_agent.noi_agent.get_case') as mock_get_case:
            mock_get_case.return_value = None
            
            result = await noi_agent.generate_challan("non-existent")
            
            assert result["success"] is False
            assert "not found" in result["error"]

    @pytest.mark.asyncio
    async def test_verify_documents_all_present(self, mock_case_data):
        """Test document verification when all documents present."""
        with patch('noi_agent.noi_agent.get_case') as mock_get_case:
            mock_get_case.return_value = mock_case_data
            
            with patch('noi_agent.noi_agent.update_noi_status') as mock_update:
                with patch('noi_agent.noi_agent._check_document') as mock_check:
                    mock_check.return_value = "PRESENT"
                    
                    result = await noi_agent.verify_documents("test-case-123")
                    
                    assert result["success"] is True
                    assert len(result["missing"]) == 0
                    mock_update.assert_called_once_with(
                        "test-case-123", 
                        "VERIFIED", 
                        notes="All documents verified"
                    )

    @pytest.mark.asyncio
    async def test_verify_documents_some_missing(self, mock_case_data):
        """Test document verification when some documents missing."""
        with patch('noi_agent.noi_agent.get_case') as mock_get_case:
            mock_get_case.return_value = mock_case_data
            
            with patch('noi_agent.noi_agent.update_noi_status') as mock_update:
                with patch('noi_agent.noi_agent._check_document') as mock_check:
                    # First call returns PRESENT, second returns MISSING, etc.
                    mock_check.side_effect = [
                        "PRESENT",  # sanction_letter
                        "MISSING",  # borrower_kyc
                        "PRESENT",  # property_docs
                        "PRESENT"   # stamp_duty_receipt
                    ]
                    
                    result = await noi_agent.verify_documents("test-case-123")
                    
                    assert result["success"] is False
                    assert "borrower_kyc" in result["missing"]
                    mock_update.assert_not_called()

    @pytest.mark.asyncio
    async def test_file_noi_eligible_statuses(self, mock_case_data):
        """Test NOI filing with eligible statuses."""
        eligible_statuses = ["CHALLAN_PAID", "VERIFIED", "NOI_DROP_RECEIVED"]
        
        for status in eligible_statuses:
            test_case = mock_case_data.copy()
            test_case["noi_status"] = status
            
            with patch('noi_agent.noi_agent.get_case') as mock_get_case:
                mock_get_case.return_value = test_case
                
                with patch('noi_agent.noi_agent.update_noi_status') as mock_update:
                    with patch('noi_agent.noi_agent._notify'):
                        with patch('noi_agent.igr_executor') as mock_igr:
                            mock_igr.file_noi = AsyncMock(
                                return_value={
                                    "success": True,
                                    "acknowledgment_number": "ACK789012"
                                }
                            )
                            
                            result = await noi_agent.file_noi("test-case-123")
                            
                            assert result["success"] is True
                            assert result["acknowledgment_number"] == "ACK789012"
                            mock_update.assert_called_once_with(
                                "test-case-123",
                                "NOI_FILED",
                                notes="Acknowledgment: ACK789012"
                            )

    @pytest.mark.asyncio
    async def test_file_noi_ineligible_status(self, mock_case_data):
        """Test NOI filing with ineligible status."""
        test_case = mock_case_data.copy()
        test_case["noi_status"] = "DOCUMENTS_RECEIVED"
        
        with patch('noi_agent.noi_agent.get_case') as mock_get_case:
            mock_get_case.return_value = test_case
            
            result = await noi_agent.file_noi("test-case-123")
            
            assert result["success"] is False
            assert "Cannot file NOI" in result["error"]

    @pytest.mark.asyncio
    async def test_acknowledge_success(self):
        """Test successful acknowledgement."""
        with patch('noi_agent.noi_agent.update_noi_status') as mock_update:
            mock_update.return_value = True
            
            with patch('noi_agent.noi_agent._notify'):
                result = await noi_agent.acknowledge("test-case-123", "ACK789012")
                
                assert result["success"] is True
                mock_update.assert_called_once_with(
                    "test-case-123",
                    "ACKNOWLEDGED",
                    notes="Acknowledgment: ACK789012"
                )

    @pytest.mark.asyncio
    async def test_run_workflow_actions(self):
        """Test the run_workflow dispatcher."""
        test_cases = [
            ("generate_challan", "generate_challan"),
            ("verify_docs", "verify_documents"),
            ("file_noi", "file_noi"),
            ("acknowledge", "acknowledge")
        ]
        
        for action_name, method_name in test_cases:
            with patch(f'noi_agent.noi_agent.{method_name}') as mock_method:
                mock_method.return_value = {"success": True}
                
                result = await noi_agent.run_workflow(
                    "test-case-123", 
                    action_name
                )
                
                assert result["success"] is True
                mock_method.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_workflow_unknown_action(self):
        """Test run_workflow with unknown action."""
        result = await noi_agent.run_workflow(
            "test-case-123", 
            "unknown_action"
        )
        
        assert result["success"] is False
        assert "Unknown NOI action" in result["error"]

    @pytest.mark.asyncio
    async def test_full_workflow_simulation(self, mock_case_data):
        """Simulate the full NOI workflow."""
        # Mock all external dependencies
        with patch('noi_agent.noi_agent.get_case') as mock_get_case:
            mock_get_case.return_value = mock_case_data
            
            with patch('noi_agent.noi_agent.update_noi_status') as mock_update:
                with patch('noi_agent.noi_agent._notify'):
                    # Mock all the external service calls
                    with patch('noi_agent.executor_agent') as mock_executor:
                        mock_executor.generate_noi_challan = AsyncMock(
                            return_value={
                                "success": True,
                                "grn_number": "GRN123456",
                                "amount_paid": "15000"
                            }
                        )
                        
                        with patch('noi_agent.igr_executor') as mock_igr:
                            mock_igr.file_noi = AsyncMock(
                                return_value={
                                    "success": True,
                                    "acknowledgment_number": "ACK789012"
                                }
                            )
                            
                            with patch('noi_agent.noi_agent._check_document') as mock_check:
                                mock_check.return_value = "PRESENT"
                                
                                # Step 1: Generate challan
                                challan_result = await noi_agent.generate_challan("test-case-123")
                                assert challan_result["success"] is True
                                
                                # Update mock case to reflect new status
                                updated_case = mock_case_data.copy()
                                updated_case["noi_status"] = "CHALLAN_GENERATED"
                                updated_case["grn_number"] = "GRN123456"
                                mock_get_case.return_value = updated_case
                                
                                # Step 2: Verify documents
                                verify_result = await noi_agent.verify_documents("test-case-123")
                                assert verify_result["success"] is True
                                
                                # Update mock case to reflect new status
                                verified_case = updated_case.copy()
                                verified_case["noi_status"] = "VERIFIED"
                                mock_get_case.return_value = verified_case
                                
                                # Step 3: File NOI
                                file_result = await noi_agent.file_noi("test-case-123")
                                assert file_result["success"] is True
                                
                                # Update mock case to reflect new status
                                filed_case = verified_case.copy()
                                filed_case["noi_status"] = "NOI_FILED"
                                filed_case["acknowledgment_number"] = "ACK789012"
                                mock_get_case.return_value = filed_case
                                
                                # Step 4: Acknowledge
                                ack_result = await noi_agent.acknowledge(
                                    "test-case-123", 
                                    "ACK789012"
                                )
                                assert ack_result["success"] is True
                                
                                # Verify all status updates were called
                                assert mock_update.call_count == 4


if __name__ == "__main__":
    pytest.main([__file__, "-v"])