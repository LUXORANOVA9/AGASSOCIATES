# jurisdictions.py

class Jurisdiction:
    def __init__(self, name, compliance_rules, currency, template_mapping):
        self.name = name
        self.compliance_rules = compliance_rules
        self.currency = currency
        self.template_mapping = template_mapping

    def get_info(self):
        return {
            'name': self.name,
            'compliance_rules': self.compliance_rules,
            'currency': self.currency,
            'template_mapping': self.template_mapping
        }


class JurisdictionRegistry:
    def __init__(self):
        self.jurisdictions = {}

    def register_jurisdiction(self, jurisdiction):
        self.jurisdictions[jurisdiction.name] = jurisdiction

    def get_jurisdiction(self, name):
        return self.jurisdictions.get(name)

    def list_jurisdictions(self):
        return list(self.jurisdictions.keys())


# Define compliance rules and currency mappings
us_compliance_rules = {'tax_rate': '7%', 'data_protection': 'GDPR'}
EU_compliance_rules = {'tax_rate': '20%', 'data_protection': 'GDPR'}
indiastate_compliance_rules = {'tax_rate': '18%', 'data_protection': 'IT Act'}


# Create a registry instance
jurisdiction_registry = JurisdictionRegistry()

# Register jurisdictions
us = Jurisdiction('United States', us_compliance_rules, 'USD', 'template_us')
jurisdiction_registry.register_jurisdiction(us)

eu = Jurisdiction('European Union', EU_compliance_rules, 'EUR', 'template_eu')
jurisdiction_registry.register_jurisdiction(eu)

india = Jurisdiction('India', indiastate_compliance_rules, 'INR', 'template_india')
jurisdiction_registry.register_jurisdiction(india)

# List all registered jurisdictions
if __name__ == '__main__':
    print(jurisdiction_registry.list_jurisdictions())
