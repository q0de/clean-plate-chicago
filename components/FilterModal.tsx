"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  RadioGroup,
  Radio,
  CheckboxGroup,
  Checkbox,
  Select,
  SelectItem,
} from "@heroui/react";

export interface Filters {
  result: string;
  riskLevels: string[];
  facilityType: string;
  lastInspected: string;
  sortBy: string;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (filters: Filters) => void;
  onReset: () => void;
  onApply: () => void;
}

const facilityTypes = [
  "Restaurant",
  "Bakery",
  "Grocery Store",
  "Coffee Shop",
  "Bar",
  "Food Truck",
];

export function FilterModal({
  isOpen,
  onClose,
  filters,
  onChange,
  onReset,
  onApply,
}: FilterModalProps) {
  const handleApply = () => {
    onApply();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="full"
      scrollBehavior="inside"
      classNames={{
        base: "sm:max-w-md sm:my-auto",
      }}
    >
      <ModalContent>
        <ModalHeader className="border-b">Filters</ModalHeader>
        
        <ModalBody className="py-6 gap-6">
          {/* Result */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Result</h4>
            <RadioGroup
              value={filters.result}
              onValueChange={(v) => onChange({ ...filters, result: v })}
              orientation="horizontal"
            >
              <Radio value="all">All</Radio>
              <Radio value="pass">Pass</Radio>
              <Radio value="conditional">Conditional</Radio>
              <Radio value="fail">Fail</Radio>
            </RadioGroup>
          </div>
          
          {/* Inspection Category */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Inspection Category</h4>
            <CheckboxGroup
              value={filters.riskLevels}
              onValueChange={(v) => onChange({ ...filters, riskLevels: v as string[] })}
              orientation="horizontal"
            >
              <Checkbox value="1">Level 1</Checkbox>
              <Checkbox value="2">Level 2</Checkbox>
              <Checkbox value="3">Level 3</Checkbox>
            </CheckboxGroup>
          </div>
          
          {/* Facility Type */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Facility Type</h4>
            <Select
              selectedKeys={filters.facilityType ? [filters.facilityType] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string | undefined;
                onChange({ ...filters, facilityType: selected || "" });
              }}
              placeholder="All types"
            >
              {facilityTypes.map((type) => (
                <SelectItem key={type}>
                  {type}
                </SelectItem>
              ))}
            </Select>
          </div>
          
          {/* Last Inspected */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Last Inspected</h4>
            <RadioGroup
              value={filters.lastInspected}
              onValueChange={(v) => onChange({ ...filters, lastInspected: v })}
            >
              <Radio value="any">Any time</Radio>
              <Radio value="90">Last 90 days</Radio>
              <Radio value="365">Last year</Radio>
            </RadioGroup>
          </div>
          
          {/* Sort By */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Sort By</h4>
            <RadioGroup
              value={filters.sortBy}
              onValueChange={(v) => onChange({ ...filters, sortBy: v })}
            >
              <Radio value="date">Most recent</Radio>
              <Radio value="score">Highest score</Radio>
              <Radio value="name">A-Z</Radio>
            </RadioGroup>
          </div>
        </ModalBody>
        
        <ModalFooter className="border-t">
          <Button variant="light" onPress={onReset}>
            Reset
          </Button>
          <Button color="primary" onPress={handleApply}>
            Apply
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}


