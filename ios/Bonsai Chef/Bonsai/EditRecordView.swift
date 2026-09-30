//
//  EditRecordView.swift
//  Bonsai Chef
//
//  Created by Nakya Tagli on 08.01.2024.
//

import SwiftUI
import PhotosUI


struct EditRecordView: View {
    @EnvironmentObject var bonsaiData: BonsaiData
    @Binding var editedName: String
    @Binding var editedCategory: BonsaiCategory
    @Binding var editedData1: String
    @Binding var editedData2: String
    @Binding var editedDateDS1: Date
    @Binding var editedStartMonthDS1: Int
    @Binding var editedEndMonthDS1: Int
    @Binding var editedDetailsDS1: String
    @Binding var editedStartMonthDS2: Int
    @Binding var editedEndMonthDS2: Int
    @Binding var editedDetailsDS2: String
    @Binding var editedStartMonthDS3: Int
    @Binding var editedEndMonthDS3: Int
    @Binding var editedDetailsDS3: String
    @Binding var editedDateDS4: Date
    @Binding var editedStartMonthDS4: Int
    @Binding var editedEndMonthDS4: Int
    @Binding var editedDetailsDS4: String
    @Binding var editedStartMonthDS5: Int
    @Binding var editedEndMonthDS5: Int
    @Binding var editedDetailsDS5: String
    @Binding var editedDataDS6: String
    @Binding var editedStartMonthDS6: Int
    @Binding var editedEndMonthDS6: Int
    @Binding var editedDetailsDS6: String
    @Binding var editedPhotos: [UIImage]
    @State private var editedPhotoPaths: [String] = []
    @State private var showImagePicker = false
    @State private var isProcessing = false
    @Environment(\.presentationMode) var presentationMode
    
    var record: BonsaiRecord
    var onEditFinished: () -> Void
    
    init(record: BonsaiRecord, editedName: Binding<String>, editedCategory: Binding<BonsaiCategory>, editedData1: Binding<String>, editedData2: Binding<String>, editedDateDS1: Binding<Date>, editedStartMonthDS1: Binding<Int>, editedEndMonthDS1: Binding<Int>, editedDetailsDS1: Binding<String>, editedStartMonthDS2: Binding<Int>, editedEndMonthDS2: Binding<Int>, editedDetailsDS2: Binding<String>, editedStartMonthDS3: Binding<Int>, editedEndMonthDS3: Binding<Int>, editedDetailsDS3: Binding<String>, editedDateDS4: Binding<Date>, editedStartMonthDS4: Binding<Int>, editedEndMonthDS4: Binding<Int>, editedDetailsDS4: Binding<String>, editedStartMonthDS5: Binding<Int>, editedEndMonthDS5: Binding<Int>, editedDetailsDS5: Binding<String>, editedDataDS6: Binding<String>, editedStartMonthDS6: Binding<Int>, editedEndMonthDS6: Binding<Int>, editedDetailsDS6: Binding<String>, editedPhotos: Binding<[UIImage]>, onEditFinished: @escaping () -> Void) {
        self.record = record
        self._editedName = editedName
        self._editedCategory = editedCategory
        self._editedData1 = editedData1
        self._editedData2 = editedData2
        self._editedDateDS1 = editedDateDS1
        self._editedStartMonthDS1 = editedStartMonthDS1
        self._editedEndMonthDS1 = editedEndMonthDS1
        self._editedDetailsDS1 = editedDetailsDS1
        self._editedStartMonthDS2 = editedStartMonthDS2
        self._editedEndMonthDS2 = editedEndMonthDS2
        self._editedDetailsDS2 = editedDetailsDS2
        self._editedStartMonthDS3 = editedStartMonthDS3
        self._editedEndMonthDS3 = editedEndMonthDS3
        self._editedDetailsDS3 = editedDetailsDS3
        self._editedDateDS4 = editedDateDS4
        self._editedStartMonthDS4 = editedStartMonthDS4
        self._editedEndMonthDS4 = editedEndMonthDS4
        self._editedDetailsDS4 = editedDetailsDS4
        self._editedStartMonthDS5 = editedStartMonthDS5
        self._editedEndMonthDS5 = editedEndMonthDS5
        self._editedDetailsDS5 = editedDetailsDS5
        self._editedDataDS6 = editedDataDS6
        self._editedStartMonthDS6 = editedStartMonthDS6
        self._editedEndMonthDS6 = editedEndMonthDS6
        self._editedDetailsDS6 = editedDetailsDS6
        self._editedPhotos = editedPhotos
        self.onEditFinished = onEditFinished
    }
    
    var body: some View {
        NavigationView {
            Form {
                Section {
                    TextField("Nome", text: $editedName)
                    Picker("Categoria", selection: $editedCategory) {
                        ForEach(BonsaiCategory.allCases.filter { $0 == .category1 || $0 == .category2 }, id: \.self) { category in
                            Text(category.rawValue).tag(category)
                        }
                    }
                    TextField("Substrato", text: $editedData1)
                    TextField("Vaso", text: $editedData2)
                }
                Section(header: Text("Rinvaso")) {
                    DatePicker("Ultimo Rinvaso", selection: $editedDateDS1, displayedComponents: .date)
                    Picker("Inizio Mese", selection: $editedStartMonthDS1) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Picker("Fine Mese", selection: $editedEndMonthDS1) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Text("Periodo Migliore: \(months[editedStartMonthDS1]) - \(months[editedEndMonthDS1])")
                    TextEditor(text: $editedDetailsDS1)
                }
                
                Section(header: Text("Potatura")) {
                    Picker("Inizio Mese", selection: $editedStartMonthDS2) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Picker("Fine Mese", selection: $editedEndMonthDS2) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Text("Periodo Migliore: \(months[editedStartMonthDS2]) - \(months[editedEndMonthDS2])")
                    TextEditor(text: $editedDetailsDS2)
                }
                
                Section(header: Text("Taglio Germogli")) {
                    Picker("Inizio Mese", selection: $editedStartMonthDS3) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Picker("Fine Mese", selection: $editedEndMonthDS3) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Text("Periodo Migliore: \(months[editedStartMonthDS3]) - \(months[editedEndMonthDS3])")
                    TextEditor(text: $editedDetailsDS3)
                }
                
                Section(header: Text("Applicazione Filo")) {
                    DatePicker("Ultima Applicazione", selection: $editedDateDS4, displayedComponents: .date)
                    Picker("Inizio Mese", selection: $editedStartMonthDS4) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Picker("Fine Mese", selection: $editedEndMonthDS4) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Text("Periodo Migliore: \(months[editedStartMonthDS4]) - \(months[editedEndMonthDS4])")
                    TextEditor(text: $editedDetailsDS4)
                }
                
                Section(header: Text("Defogliazione")) {
                    Picker("Inizio Mese", selection: $editedStartMonthDS5) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Picker("Fine Mese", selection: $editedEndMonthDS5) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Text("Periodo Migliore: \(months[editedStartMonthDS5]) - \(months[editedEndMonthDS5])")
                    TextEditor(text: $editedDetailsDS5)
                }
                
                Section(header: Text("Concimazione")) {
                    TextField("Tipologia di Concime", text: $editedDataDS6)
                    Picker("Inzio Mese", selection: $editedStartMonthDS6) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Picker("Fine Mese", selection: $editedEndMonthDS6) {
                        ForEach(0 ..< months.count) { index in
                            Text(months[index]).tag(index)
                        }
                    }
                    .pickerStyle(SegmentedPickerStyle())
                    Text("Periodo Migliore: \(months[editedStartMonthDS6]) - \(months[editedEndMonthDS6])")
                    TextEditor(text: $editedDetailsDS6)
                }
                
                Section(header: Text("Fotos")) {
                    HStack {
                        Text("Fotos:")
                        Spacer()
                        Button("Aggiungi Foto") {
                            showImagePicker = true
                        }
                        .sheet(isPresented: $showImagePicker) {
                            ImagePicker(selectedImages: $editedPhotos)
                        }
                    }
                    
                    ForEach(editedPhotos.indices, id: \.self) { index in
                        Image(uiImage: editedPhotos[index])
                            .resizable()
                            .scaledToFit()
                            .frame(height: 100)
                            .onTapGesture {
                                editedPhotos.remove(at: index)
                            }
                    }
                }
                
                Section {
                    Button("Salva Modifiche") {
                        isProcessing = true
                        DispatchQueue.global(qos: .userInitiated).async {
                            saveChanges()
                            DispatchQueue.main.async {
                                isProcessing = false
                                presentationMode.wrappedValue.dismiss()
                            }
                        }
                    }
                    .disabled(isProcessing)
                }
            }
            .navigationTitle("Modifica Bonsai")
            .navigationBarItems(trailing: Button("Annulla") {
                presentationMode.wrappedValue.dismiss()
            })
            .overlay(
                Group {
                    if isProcessing {
                        ProgressView("Salvo Cambiamenti...")
                            .padding()
                            .background(Color.secondary.colorInvert())
                            .cornerRadius(10)
                            .shadow(radius: 10)
                    }
                }
            )
        }
    }
    
    func saveChanges() {
            isProcessing = true
            
            DispatchQueue.global(qos: .userInitiated).async {
                let photoPaths = editedPhotos.compactMap { saveImageToDocumentDirectory($0) }
                
                DispatchQueue.main.async {
                    if let index = bonsaiData.records.firstIndex(where: { $0.id == record.id }) {
                        bonsaiData.records[index].name = editedName
                        bonsaiData.records[index].category = editedCategory
                        bonsaiData.records[index].data1 = editedData1
                        bonsaiData.records[index].data2 = editedData2
                        bonsaiData.records[index].dateDS1 = editedDateDS1
                        bonsaiData.records[index].selectedStartMonthDS1 = editedStartMonthDS1
                        bonsaiData.records[index].selectedEndMonthDS1 = editedEndMonthDS1
                        bonsaiData.records[index].detailsDS1 = editedDetailsDS1
                        bonsaiData.records[index].selectedStartMonthDS2 = editedStartMonthDS2
                        bonsaiData.records[index].selectedEndMonthDS2 = editedEndMonthDS2
                        bonsaiData.records[index].detailsDS2 = editedDetailsDS2
                        bonsaiData.records[index].selectedStartMonthDS3 = editedStartMonthDS3
                        bonsaiData.records[index].selectedEndMonthDS3 = editedEndMonthDS3
                        bonsaiData.records[index].detailsDS3 = editedDetailsDS3
                        bonsaiData.records[index].dateDS4 = editedDateDS4
                        bonsaiData.records[index].selectedStartMonthDS4 = editedStartMonthDS4
                        bonsaiData.records[index].selectedEndMonthDS4 = editedEndMonthDS4
                        bonsaiData.records[index].detailsDS4 = editedDetailsDS4
                        bonsaiData.records[index].selectedStartMonthDS5 = editedStartMonthDS5
                        bonsaiData.records[index].selectedEndMonthDS5 = editedEndMonthDS5
                        bonsaiData.records[index].detailsDS5 = editedDetailsDS5
                        bonsaiData.records[index].dataDS6 = editedDataDS6
                        bonsaiData.records[index].selectedStartMonthDS6 = editedStartMonthDS6
                        bonsaiData.records[index].selectedEndMonthDS6 = editedEndMonthDS6
                        bonsaiData.records[index].detailsDS6 = editedDetailsDS6
                        bonsaiData.records[index].photoPaths = photoPaths
                        
                        bonsaiData.objectWillChange.send()
                        bonsaiData.saveRecords()
                    }
                    
                    isProcessing = false
                    onEditFinished()
                    presentationMode.wrappedValue.dismiss()
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
    
    func loadImageFromDocumentDirectory(_ fileName: String) -> UIImage? {
        let fileURL = getDocumentsDirectory().appendingPathComponent(fileName)
        if let data = try? Data(contentsOf: fileURL), let image = UIImage(data: data) {
            return image
        }
        return nil
    }
}
