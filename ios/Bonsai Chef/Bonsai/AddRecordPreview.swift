//
//  AddRecordPreview.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 08.01.2024.
//

import SwiftUI
import PhotosUI

struct AddRecordView: View {
    @ObservedObject var bonsaiData: BonsaiData
    @State private var name = ""
    @State private var category: BonsaiCategory = .category1
    @State private var data1 = ""
    @State private var data2 = ""
    @State private var selectedDateDS1 = Date()
    @State private var selectedStartMonthDS1 = 0
    @State private var selectedEndMonthDS1 = 0
    @State private var detailsDS1 = ""
    @State private var selectedStartMonthDS2 = 0
    @State private var selectedEndMonthDS2 = 0
    @State private var detailsDS2 = ""
    @State private var selectedStartMonthDS3 = 0
    @State private var selectedEndMonthDS3 = 0
    @State private var detailsDS3 = ""
    @State private var selectedDateDS4 = Date()
    @State private var selectedStartMonthDS4 = 0
    @State private var selectedEndMonthDS4 = 0
    @State private var detailsDS4 = ""
    @State private var selectedStartMonthDS5 = 0
    @State private var selectedEndMonthDS5 = 0
    @State private var detailsDS5 = ""
    @State private var dataDS6 = ""
    @State private var selectedStartMonthDS6 = 0
    @State private var selectedEndMonthDS6 = 0
    @State private var detailsDS6 = ""
    @State private var selectedPhotos: [UIImage] = []
    @State private var showImagePicker = false
    @Environment(\.presentationMode) var presentationMode
    var onDismiss: () -> Void

    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("Nome", text: $name)
                    Picker("Categoria", selection: $category) {
                        ForEach(BonsaiCategory.allCases.filter { $0 == .category1 || $0 == .category2 }, id: \.self) { category in
                            Text(category.rawValue).tag(category)
                        }
                    }

        
                    TextField("Substrato", text: $data1)
                    TextField("Vaso", text: $data2)
                }
                Section(header: Text("Rinvaso")) {
                    DatePicker("Ultimo Rinvaso", selection: $selectedDateDS1, displayedComponents: .date)
                    // Picker for selecting start month
                                Picker("Inizio Mese", selection: $selectedStartMonthDS1) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Picker for selecting end month
                                Picker("Fine Mese", selection: $selectedEndMonthDS1) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Display selected range in one line
                                Text("Periodo Migliore: \(months[selectedStartMonthDS1]) - \(months[selectedEndMonthDS1])")
                    TextEditor(text: $detailsDS1)
                }
                
                Section(header: Text("Potatura")) {
                    // Picker for selecting start month
                                Picker("Inizio Mese", selection: $selectedStartMonthDS2) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Picker for selecting end month
                                Picker("Fine Mese", selection: $selectedEndMonthDS2) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Display selected range in one line
                                Text("Periodo Migliore: \(months[selectedStartMonthDS2]) - \(months[selectedEndMonthDS2])")
                    TextEditor(text: $detailsDS2)
                }
                
                Section(header: Text("Taglio Germogli")) {
                    // Picker for selecting start month
                                Picker("Inzio Mese", selection: $selectedStartMonthDS3) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Picker for selecting end month
                                Picker("Fine Mese", selection: $selectedEndMonthDS3) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Display selected range in one line
                                Text("Periodo Migliore: \(months[selectedStartMonthDS3]) - \(months[selectedEndMonthDS3])")
                    TextEditor(text: $detailsDS3)
                }
                
                Section(header: Text("Applicazione Filo")) {
                    DatePicker("Ultima Applicazione", selection: $selectedDateDS4, displayedComponents: .date)
                    // Picker for selecting start month
                                Picker("Inizio Mese", selection: $selectedStartMonthDS4) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Picker for selecting end month
                                Picker("Fine Mese", selection: $selectedEndMonthDS4) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Display selected range in one line
                                Text("Periodo Migliore: \(months[selectedStartMonthDS4]) - \(months[selectedEndMonthDS4])")
                    TextEditor(text: $detailsDS4)
                }
                
                Section(header: Text("Defogliazione")) {
                    // Picker for selecting start month
                                Picker("Inizio Mese", selection: $selectedStartMonthDS5) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Picker for selecting end month
                                Picker("Fine Mese", selection: $selectedEndMonthDS5) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Display selected range in one line
                                Text("Periodo Migliore: \(months[selectedStartMonthDS5]) - \(months[selectedEndMonthDS5])")
                    TextEditor(text: $detailsDS5)
                }
                
                Section(header: Text("Concimazione")) {
                    TextField("Tipologia di Concime", text: $dataDS6)
                    // Picker for selecting start month
                                Picker("Inizio Mese", selection: $selectedStartMonthDS6) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Picker for selecting end month
                                Picker("Fine Mese", selection: $selectedEndMonthDS6) {
                                    ForEach(0 ..< months.count) {
                                        Text(months[$0])
                                    }
                                }
                                .pickerStyle(SegmentedPickerStyle())
                                
                                // Display selected range in one line
                                Text("Periodo Migliore: \(months[selectedStartMonthDS6]) - \(months[selectedEndMonthDS6])")
                    TextEditor(text: $detailsDS6)
                }

                Section(header: Text("Fotos")) {
                    Button("Aggiungi Foto") {
                        showImagePicker = true
                    }
                    .sheet(isPresented: $showImagePicker) {
                        ImagePicker(selectedImages: $selectedPhotos)
                    }

                    ScrollView(.horizontal) {
                        HStack {
                            ForEach(selectedPhotos, id: \.self) { image in
                                Image(uiImage: image)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 100, height: 100)
                                    .clipped()
                            }
                        }
                    }
                }

                Section {
                    Button(action: {
                        let photoPaths = selectedPhotos.compactMap { saveImageToDocumentDirectory($0) ?? "" }
                        bonsaiData.records.append(BonsaiRecord(
                            name: name,
                            category: BonsaiCategory(rawValue: category.rawValue) ?? .category1,
                            data1: data1,
                            data2: data2,
                            dateDS1: selectedDateDS1,
                            selectedStartMonthDS1: selectedStartMonthDS1,
                            selectedEndMonthDS1: selectedEndMonthDS1,
                            detailsDS1: detailsDS1,
                            selectedStartMonthDS2: selectedStartMonthDS2,
                            selectedEndMonthDS2: selectedEndMonthDS2,
                            detailsDS2: detailsDS2,
                            selectedStartMonthDS3: selectedStartMonthDS3,
                            selectedEndMonthDS3: selectedEndMonthDS3,
                            detailsDS3: detailsDS3,
                            dateDS4: selectedDateDS4,
                            selectedStartMonthDS4: selectedStartMonthDS4,
                            selectedEndMonthDS4: selectedEndMonthDS4,
                            detailsDS4: detailsDS4,
                            selectedStartMonthDS5: selectedStartMonthDS5,
                            selectedEndMonthDS5: selectedEndMonthDS5,
                            detailsDS5: detailsDS5,
                            dataDS6: dataDS6,
                            selectedStartMonthDS6: selectedStartMonthDS6,
                            selectedEndMonthDS6: selectedEndMonthDS6,
                            detailsDS6: detailsDS6,
                            photoPaths: photoPaths
                        ))
                        bonsaiData.saveRecords() // Save records to UserDefaults
                        name = ""
                        category = .category1
                        data1 = ""
                        data2 = ""
                        selectedDateDS1 = Date()
                        detailsDS1 = ""
                        detailsDS2 = ""
                        detailsDS3 = ""
                        selectedDateDS4 = Date()
                        detailsDS4 = ""
                        detailsDS5 = ""
                        dataDS6 = ""
                        detailsDS6 = ""
                        selectedPhotos.removeAll()
                        onDismiss()
                    }) {
                        Text("Salva")
                    }
                }

            }
            .navigationTitle("Aggiungi Bonsai")
            .navigationBarItems(trailing: Button("Annulla") {
                presentationMode.wrappedValue.dismiss()
            })
        }
    }
}

private func saveImageToDocumentDirectory(_ image: UIImage) -> String? {
        guard let data = image.jpegData(compressionQuality: 0.8) else { return nil }
        let fileName = UUID().uuidString + ".jpeg"
        let fileURL = getDocumentsDirectory().appendingPathComponent(fileName)
        do {
            try data.write(to: fileURL)
            return fileName
        } catch {
            print("Error saving image: \(error)")
            return nil
        }
    }

    private func getDocumentsDirectory() -> URL {
        return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
    }



